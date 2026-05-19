#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
WILLAY · Entrenamiento offline (PC) con validación walk-forward
================================================================
Script SEPARADO del runtime de la Raspberry Pi. Entrena dos modelos:

  - model_helada_t3  → P(helada en t+3 días)   (RandomForestClassifier)
  - model_sequia_t3  → P(sequía en t+3 días)   (RandomForestClassifier)

Cumple consigna del profesor:
  * Series temporales con validación walk-forward por año (no split aleatorio)
  * Features con lags (1,2,3) + rolling(3) + días_secos_acumulados(30)
  * Reporta Recall / Precision / F1 por año + promedio
  * Genera walk_forward_validation.png
  * class_weight="balanced" (las heladas son evento raro)

Datasets (Kaggle):
  - brigitteadhar49/punoeras5   → histórico ERA5 Puno (entrenamiento)
  - brigitteadhar49/puno2026    → datos recientes 2026 (validación final)

Uso:
    pip install kagglehub[pandas-datasets] scikit-learn pandas numpy matplotlib joblib
    python willay_train_walkforward.py
    python willay_train_walkforward.py --xgb       # usar XGBoost en lugar de RF
    python willay_train_walkforward.py --no-kaggle # usar CSV local willay_hist.csv

Salida:
    willay_model.pkl   → diccionario con ambos modelos + metadatos
    walk_forward_validation.png
    report.json
"""

import argparse
import json
import os
import sys
from datetime import datetime

import numpy as np
import pandas as pd

# ─────────────────────────────────────────────────────────────────────
# CONFIGURACIÓN
# ─────────────────────────────────────────────────────────────────────
HORIZONTE_DIAS   = 3       # predecir helada/sequía a 3 días
UMBRAL_HELADA_C  = 0.0     # T_min ≤ 0°C → helada
UMBRAL_SEQUIA_MM = 1.0     # precipitación diaria ≤ 1mm → día seco
VENTANA_SEQUIA_D = 30      # días secos acumulados en últimos 30 días
MIN_DIAS_SECOS   = 20      # ≥20 días secos en 30 → sequía

MODEL_PATH       = "willay_model.pkl"
REPORT_PATH      = "report.json"
PLOT_PATH        = "walk_forward_validation.png"

KAGGLE_TRAIN     = "brigitteadhar49/punoeras5"
KAGGLE_TEST      = "brigitteadhar49/puno2026"


# ─────────────────────────────────────────────────────────────────────
# CARGA DE DATOS
# ─────────────────────────────────────────────────────────────────────
def load_kaggle(dataset: str) -> pd.DataFrame:
    """Carga el primer CSV/parquet del dataset Kaggle indicado."""
    import kagglehub
    from kagglehub import KaggleDatasetAdapter

    # Intentamos descubrir el archivo principal
    candidates = ["", "puno.csv", "puno_clima_era5.csv",
                  "puno_era5.csv", "data.csv", "puno2026.csv"]
    last_err = None
    for fp in candidates:
        try:
            df = kagglehub.load_dataset(
                KaggleDatasetAdapter.PANDAS, dataset, fp)
            print(f"✅ {dataset}  ←  '{fp or '(auto)'}'   filas={len(df)}")
            return df
        except Exception as e:
            last_err = e
            continue
    raise RuntimeError(f"No pude cargar {dataset}: {last_err}")


def normalize(df: pd.DataFrame) -> pd.DataFrame:
    """Renombra columnas comunes a un esquema estándar:
       date, t_min, t_max, t_mean, precip, humidity, soil
    """
    rename = {}
    for c in df.columns:
        cl = c.lower().strip()
        if cl in ("date", "fecha", "time", "datetime", "ds"): rename[c] = "date"
        elif "tmin" in cl or "t_min" in cl or cl == "tn":     rename[c] = "t_min"
        elif "tmax" in cl or "t_max" in cl or cl == "tx":     rename[c] = "t_max"
        elif "tmean" in cl or "t_mean" in cl or cl in ("t","temp","temperature"):
            rename[c] = "t_mean"
        elif "precip" in cl or cl in ("pp","rain","prcp"):    rename[c] = "precip"
        elif "humid" in cl or cl in ("h","rh"):               rename[c] = "humidity"
        elif "soil" in cl or cl == "s":                       rename[c] = "soil"
    df = df.rename(columns=rename).copy()
    if "date" not in df.columns:
        raise ValueError(f"No encontré columna de fecha en {df.columns.tolist()}")
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df = df.dropna(subset=["date"]).sort_values("date").reset_index(drop=True)
    # rellenos suaves
    for col in ("t_min","t_max","t_mean","precip","humidity","soil"):
        if col not in df.columns:
            df[col] = np.nan
    if df["t_mean"].isna().all() and not df["t_min"].isna().all():
        df["t_mean"] = (df["t_min"] + df["t_max"]) / 2
    return df


# ─────────────────────────────────────────────────────────────────────
# FEATURE ENGINEERING
# ─────────────────────────────────────────────────────────────────────
def build_features(df: pd.DataFrame) -> pd.DataFrame:
    d = df.copy()
    # lags 1,2,3 + rolling 3
    for col in ("t_min","t_mean","precip","humidity"):
        if col in d.columns:
            for lag in (1,2,3):
                d[f"{col}_lag{lag}"] = d[col].shift(lag)
            d[f"{col}_roll3"] = d[col].shift(1).rolling(3).mean()

    # día seco + acumulado
    d["dia_seco"] = (d["precip"].fillna(0) <= UMBRAL_SEQUIA_MM).astype(int)
    d["dias_secos_acumulados"] = (
        d["dia_seco"].shift(1).rolling(VENTANA_SEQUIA_D, min_periods=5).sum()
    )

    # estacionalidad
    d["mes"] = d["date"].dt.month
    d["dia_ano"] = d["date"].dt.dayofyear
    d["sin_doy"] = np.sin(2*np.pi*d["dia_ano"]/365)
    d["cos_doy"] = np.cos(2*np.pi*d["dia_ano"]/365)

    # targets a t+3 días
    d["helada_t3"] = (d["t_min"].shift(-HORIZONTE_DIAS) <= UMBRAL_HELADA_C).astype(int)
    d["sequia_t3"] = (
        d["dia_seco"].shift(-HORIZONTE_DIAS).rolling(VENTANA_SEQUIA_D).sum()
        >= MIN_DIAS_SECOS
    ).astype(int)

    d["year"] = d["date"].dt.year
    return d.dropna().reset_index(drop=True)


FEATURE_COLS = [
    "t_min","t_mean","precip","humidity",
    "t_min_lag1","t_min_lag2","t_min_lag3","t_min_roll3",
    "t_mean_lag1","t_mean_lag2","t_mean_lag3","t_mean_roll3",
    "precip_lag1","precip_lag2","precip_lag3","precip_roll3",
    "humidity_lag1","humidity_lag2","humidity_lag3","humidity_roll3",
    "dias_secos_acumulados","mes","sin_doy","cos_doy",
]


# ─────────────────────────────────────────────────────────────────────
# WALK-FORWARD VALIDATION
# ─────────────────────────────────────────────────────────────────────
def _make_estimator(use_xgb: bool):
    if use_xgb:
        from xgboost import XGBClassifier
        return XGBClassifier(
            n_estimators=300, max_depth=5, learning_rate=0.05,
            scale_pos_weight=5, eval_metric="logloss", use_label_encoder=False)
    from sklearn.ensemble import RandomForestClassifier
    return RandomForestClassifier(
        n_estimators=300, max_depth=10, min_samples_leaf=5,
        class_weight="balanced", n_jobs=-1, random_state=42)


def walk_forward(df: pd.DataFrame, target: str, use_xgb: bool):
    from sklearn.metrics import precision_score, recall_score, f1_score
    feats = [c for c in FEATURE_COLS if c in df.columns]
    years = sorted(df["year"].unique())
    rows = []
    last_model = None
    for i in range(1, len(years)):
        train_years = years[:i]
        test_year   = years[i]
        tr = df[df["year"].isin(train_years)]
        te = df[df["year"] == test_year]
        if te[target].sum() == 0 or len(te) < 30:
            continue
        est = _make_estimator(use_xgb)
        est.fit(tr[feats], tr[target])
        pred = est.predict(te[feats])
        rows.append({
            "year": int(test_year),
            "n_test": int(len(te)),
            "positivos_reales": int(te[target].sum()),
            "precision": float(precision_score(te[target], pred, zero_division=0)),
            "recall":    float(recall_score(te[target], pred, zero_division=0)),
            "f1":        float(f1_score(te[target], pred, zero_division=0)),
        })
        last_model = est
    # entrenar modelo final con TODO
    final = _make_estimator(use_xgb)
    final.fit(df[feats], df[target])
    return final, rows, feats


def plot_results(res_helada, res_sequia, path):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))
    for ax, res, title in [(axes[0], res_helada, "Helada t+3"),
                            (axes[1], res_sequia, "Sequía t+3")]:
        if not res:
            ax.set_title(f"{title} (sin datos)"); continue
        ys = [r["year"] for r in res]
        ax.plot(ys, [r["precision"] for r in res], "o-", label="Precision")
        ax.plot(ys, [r["recall"]    for r in res], "s-", label="Recall")
        ax.plot(ys, [r["f1"]        for r in res], "^-", label="F1")
        ax.set_title(f"Walk-forward · {title}")
        ax.set_xlabel("Año test"); ax.set_ylim(0,1); ax.grid(True, alpha=.3)
        ax.legend()
    plt.tight_layout(); plt.savefig(path, dpi=120)
    print(f"📊 Gráfico → {path}")


# ─────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--xgb", action="store_true",
                    help="Usar XGBoost en lugar de RandomForest")
    ap.add_argument("--no-kaggle", action="store_true",
                    help="Usar CSV local willay_hist.csv en vez de Kaggle")
    ap.add_argument("--local-csv", default="willay_hist.csv")
    args = ap.parse_args()

    # 1) Cargar datos
    if args.no_kaggle:
        if not os.path.exists(args.local_csv):
            sys.exit(f"❌ No existe {args.local_csv}")
        df_train = normalize(pd.read_csv(args.local_csv))
        df_test  = None
    else:
        df_train = normalize(load_kaggle(KAGGLE_TRAIN))
        try:
            df_test = normalize(load_kaggle(KAGGLE_TEST))
        except Exception as e:
            print(f"⚠️  No pude cargar {KAGGLE_TEST}: {e}")
            df_test = None

    # 2) Features + targets
    feat_train = build_features(df_train)
    print(f"📦 Train: {len(feat_train)} filas | "
          f"helada+={feat_train['helada_t3'].sum()} | "
          f"sequia+={feat_train['sequia_t3'].sum()}")

    # 3) Walk-forward por año
    print("\n──── HELADA t+3 ────")
    m_hel, res_hel, feats = walk_forward(feat_train, "helada_t3", args.xgb)
    for r in res_hel: print(r)

    print("\n──── SEQUIA t+3 ────")
    m_seq, res_seq, _ = walk_forward(feat_train, "sequia_t3", args.xgb)
    for r in res_seq: print(r)

    def _avg(rs, k): return float(np.mean([r[k] for r in rs])) if rs else 0.0
    summary = {
        "modelo": "xgboost" if args.xgb else "random_forest",
        "horizonte_dias": HORIZONTE_DIAS,
        "helada": {
            "por_anio": res_hel,
            "precision_avg": _avg(res_hel, "precision"),
            "recall_avg":    _avg(res_hel, "recall"),
            "f1_avg":        _avg(res_hel, "f1"),
        },
        "sequia": {
            "por_anio": res_seq,
            "precision_avg": _avg(res_seq, "precision"),
            "recall_avg":    _avg(res_seq, "recall"),
            "f1_avg":        _avg(res_seq, "f1"),
        },
    }

    # 4) Validación final con dataset 2026 si está
    if df_test is not None:
        feat_test = build_features(df_test)
        if len(feat_test) > 0:
            from sklearn.metrics import precision_score, recall_score, f1_score
            ph = m_hel.predict(feat_test[feats])
            ps = m_seq.predict(feat_test[feats])
            summary["validacion_2026"] = {
                "n": int(len(feat_test)),
                "helada": {
                    "precision": float(precision_score(feat_test["helada_t3"], ph, zero_division=0)),
                    "recall":    float(recall_score(feat_test["helada_t3"], ph, zero_division=0)),
                    "f1":        float(f1_score(feat_test["helada_t3"], ph, zero_division=0)),
                },
                "sequia": {
                    "precision": float(precision_score(feat_test["sequia_t3"], ps, zero_division=0)),
                    "recall":    float(recall_score(feat_test["sequia_t3"], ps, zero_division=0)),
                    "f1":        float(f1_score(feat_test["sequia_t3"], ps, zero_division=0)),
                },
            }

    # 5) Guardar artefactos
    plot_results(res_hel, res_seq, PLOT_PATH)
    with open(REPORT_PATH, "w") as f:
        json.dump(summary, f, indent=2)
    print(f"📝 Reporte → {REPORT_PATH}")

    import pickle
    with open(MODEL_PATH, "wb") as f:
        pickle.dump({
            "kind": "rf_walkforward" if not args.xgb else "xgb_walkforward",
            "features": feats,
            "model_helada": m_hel,
            "model_sequia": m_seq,
            "report": summary,
            "trained_at": datetime.utcnow().isoformat(),
        }, f)
    print(f"✅ Modelo guardado → {MODEL_PATH}")
    print(f"   Copiar a la Pi:  scp {MODEL_PATH} pi@<ip>:/home/pi/")


if __name__ == "__main__":
    main()