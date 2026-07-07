# %% [code] {"execution":{"iopub.status.busy":"2026-07-06T01:22:28.636622Z","iopub.execute_input":"2026-07-06T01:22:28.636858Z"}}
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
WILLAY · Entrenamiento offline con validación walk-forward
============================================================
VERSIÓN CORREGIDA PARA KAGGLE NOTEBOOKS.

Cambios respecto al original:
  1) Carga los datasets directamente desde /kaggle/input/... (así se agregan
     con "Add Input" en el notebook) en vez de usar kagglehub para descargar
     algo que ya está montado. Si no se encuentra ahí, intenta kagglehub
     como respaldo (útil si corres esto fuera de Kaggle).
  2) FEATURE_COLS ya no es una lista fija: se calcula dinámicamente según
     qué columnas realmente tengan datos. Esto evita el bug de que una
     columna opcional (humidity/soil) totalmente NaN hiciera que el
     dropna() final borrara TODAS las filas del dataset.
  3. dropna() ahora sólo se aplica sobre las columnas que realmente se usan
     (features + targets), no sobre el DataFrame completo.
  4) Se quitó `use_label_encoder=False` de XGBClassifier (parámetro removido
     en xgboost >= 2.0, causa TypeError con las versiones actuales de Kaggle).
  5) `datetime.utcnow()` (deprecado) -> `datetime.now(timezone.utc)`.
  6) Todas las salidas se guardan explícitamente en /kaggle/working/.

Cumple consigna del profesor:
  * Series temporales con validación walk-forward por año (no split aleatorio)
  * Features con lags (1,2,3) + rolling(3) + días_secos_acumulados(30)
  * Reporta Recall / Precision / F1 por año + promedio
  * Genera walk_forward_validation.png
  * class_weight="balanced" (las heladas son evento raro)

Uso en un notebook de Kaggle:
    1. Add Input -> brigitteadhar49/punoeras5  y  brigitteadhar49/puno2026
    2. !python willay_train_walkforward_kaggle.py
       !python willay_train_walkforward_kaggle.py --xgb   (para usar XGBoost)

Salida (en /kaggle/working/):
    willay_model.pkl
    walk_forward_validation.png
    report.json
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone

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

# Directorio de salida: /kaggle/working si existe (notebook de Kaggle),
# si no, el directorio actual.
OUT_DIR = "/kaggle/working" if os.path.isdir("/kaggle/working") else "."
MODEL_PATH  = os.path.join(OUT_DIR, "willay_model.pkl")
REPORT_PATH = os.path.join(OUT_DIR, "report.json")
PLOT_PATH   = os.path.join(OUT_DIR, "walk_forward_validation.png")

KAGGLE_TRAIN = "brigitteadhar49/punoeras5"
KAGGLE_TEST  = "brigitteadhar49/puno2026"


# ─────────────────────────────────────────────────────────────────────
# CARGA DE DATOS
# ─────────────────────────────────────────────────────────────────────
def _slug(s: str) -> str:
    return s.lower().replace("_", "").replace("-", "").replace(" ", "")


def load_from_kaggle_input(dataset: str):
    """Busca el dataset ya montado en /kaggle/input/<nombre>/... y carga
    el primer csv/parquet que encuentre. Devuelve None si no está montado
    (por ejemplo, corriendo fuera de Kaggle o si falta 'Add Input')."""
    base = "/kaggle/input"
    if not os.path.isdir(base):
        return None

    target = _slug(dataset.split("/")[-1])
    candidatos = []
    for d in os.listdir(base):
        if target in _slug(d) or _slug(d) in target:
            candidatos.append(os.path.join(base, d))

    for carpeta in candidatos:
        for root, _, files in os.walk(carpeta):
            for f in sorted(files):
                fl = f.lower()
                path = os.path.join(root, f)
                if fl.endswith(".csv"):
                    print(f"✅ {dataset}  ←  {path}")
                    return pd.read_csv(path)
                if fl.endswith(".parquet"):
                    print(f"✅ {dataset}  ←  {path}")
                    return pd.read_parquet(path)
    return None


def load_kaggle_via_hub(dataset: str) -> pd.DataFrame:
    """Respaldo: descarga vía kagglehub (útil fuera de un notebook Kaggle)."""
    import kagglehub
    from kagglehub import KaggleDatasetAdapter

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


def load_kaggle(dataset: str) -> pd.DataFrame:
    df = load_from_kaggle_input(dataset)
    if df is not None:
        return df
    print(f"ℹ️  '{dataset}' no está en /kaggle/input, probando kagglehub...")
    return load_kaggle_via_hub(dataset)


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
    # rellenos suaves (columnas ausentes quedan como NaN explícito)
    for col in ("t_min","t_max","t_mean","precip","humidity","soil"):
        if col not in df.columns:
            df[col] = np.nan
    if df["t_mean"].isna().all() and not df["t_min"].isna().all():
        df["t_mean"] = (df["t_min"] + df["t_max"]) / 2
    return df


# ─────────────────────────────────────────────────────────────────────
# FEATURE ENGINEERING
# ─────────────────────────────────────────────────────────────────────
def build_features(df: pd.DataFrame):
    """Devuelve (dataframe_con_features, lista_de_columnas_feature).

    IMPORTANTE: sólo se generan lags/rolling para columnas que tengan al
    menos un dato real. Esto evita que una columna opcional (humidity,
    soil) totalmente vacía arrastre NaN a todas las filas y el dropna()
    final borre el dataset completo.
    """
    d = df.copy()
    feature_cols = []

    columnas_base = [c for c in ("t_min", "t_mean", "precip", "humidity")
                      if c in d.columns and d[c].notna().any()]

    for col in columnas_base:
        feature_cols.append(col)
        for lag in (1, 2, 3):
            fcol = f"{col}_lag{lag}"
            d[fcol] = d[col].shift(lag)
            feature_cols.append(fcol)
        rcol = f"{col}_roll3"
        d[rcol] = d[col].shift(1).rolling(3).mean()
        feature_cols.append(rcol)

    # día seco + acumulado (requiere precip; si no existe, se asume 0 -> sin días secos)
    d["dia_seco"] = (d["precip"].fillna(0) <= UMBRAL_SEQUIA_MM).astype(int)
    d["dias_secos_acumulados"] = (
        d["dia_seco"].shift(1).rolling(VENTANA_SEQUIA_D, min_periods=5).sum()
    )
    feature_cols.append("dias_secos_acumulados")

    # estacionalidad (siempre disponible por venir de 'date')
    d["mes"] = d["date"].dt.month
    d["dia_ano"] = d["date"].dt.dayofyear
    d["sin_doy"] = np.sin(2*np.pi*d["dia_ano"]/365)
    d["cos_doy"] = np.cos(2*np.pi*d["dia_ano"]/365)
    feature_cols += ["mes", "sin_doy", "cos_doy"]

    # targets a t+3 días (requieren t_min y precip; si faltan, targets serán NaN
    # y esas filas se descartan más abajo)
    d["helada_t3"] = (d["t_min"].shift(-HORIZONTE_DIAS) <= UMBRAL_HELADA_C).astype("float")
    d.loc[d["t_min"].shift(-HORIZONTE_DIAS).isna(), "helada_t3"] = np.nan

    sequia_raw = d["dia_seco"].shift(-HORIZONTE_DIAS).rolling(VENTANA_SEQUIA_D).sum()
    d["sequia_t3"] = (sequia_raw >= MIN_DIAS_SECOS).astype("float")
    d.loc[sequia_raw.isna(), "sequia_t3"] = np.nan

    d["year"] = d["date"].dt.year

    # Sólo tiramos filas incompletas en las columnas que de verdad usamos
    cols_necesarias = feature_cols + ["helada_t3", "sequia_t3", "year", "date"]
    d = d.dropna(subset=cols_necesarias).reset_index(drop=True)
    d["helada_t3"] = d["helada_t3"].astype(int)
    d["sequia_t3"] = d["sequia_t3"].astype(int)

    return d, feature_cols


# ─────────────────────────────────────────────────────────────────────
# 2ª CAPA · MODELO DEL ERROR (residual sensor − satélite)
# ─────────────────────────────────────────────────────────────────────
RESIDUAL_FEATURES = [
    "t_min", "humidity", "soil", "mes", "sin_doy", "cos_doy",
    "t_min_lag1", "humidity_lag1",
]


def train_residual_model(df: pd.DataFrame):
    """Entrena g(features) ≈ T_sensor − T_satélite.
    Devuelve (modelo, métricas) o (None, None) si faltan columnas.
    """
    if "t_min_sensor" not in df.columns or df["t_min_sensor"].isna().all():
        print("ℹ️  No hay columna t_min_sensor → se omite 2ª capa (residual).")
        return None, None
    from sklearn.ensemble import RandomForestRegressor
    from sklearn.metrics import mean_absolute_error

    d = df.dropna(subset=["t_min_sensor", "t_min"]).copy()
    d["residual"] = d["t_min_sensor"] - d["t_min"]  # sensor − satélite
    feats = [c for c in RESIDUAL_FEATURES if c in d.columns]
    if len(d) < 50:
        print(f"ℹ️  Pocos pares sensor/satélite ({len(d)}) → 2ª capa omitida.")
        return None, None

    years = sorted(d["year"].unique())
    rows = []
    for i in range(1, len(years)):
        tr = d[d["year"].isin(years[:i])]
        te = d[d["year"] == years[i]]
        if len(te) < 20:
            continue
        est = RandomForestRegressor(n_estimators=200, max_depth=6,
                                     min_samples_leaf=5, n_jobs=-1, random_state=42)
        est.fit(tr[feats], tr["residual"])
        pred = est.predict(te[feats])
        mae_base = mean_absolute_error(te["t_min_sensor"], te["t_min"])
        mae_corr = mean_absolute_error(te["t_min_sensor"], te["t_min"] + pred)
        rows.append({
            "year": int(years[i]),
            "mae_base_satelite": float(mae_base),
            "mae_corregido_2capas": float(mae_corr),
            "mejora_pct": float(100 * (mae_base - mae_corr) / max(mae_base, 1e-6)),
        })

    final = RandomForestRegressor(n_estimators=300, max_depth=6,
                                   min_samples_leaf=5, n_jobs=-1, random_state=42)
    final.fit(d[feats], d["residual"])
    metrics = {
        "n_train": int(len(d)),
        "features": feats,
        "por_anio": rows,
        "mae_base_avg":      float(np.mean([r["mae_base_satelite"] for r in rows])) if rows else 0.0,
        "mae_corregido_avg": float(np.mean([r["mae_corregido_2capas"] for r in rows])) if rows else 0.0,
        "mejora_pct_avg":    float(np.mean([r["mejora_pct"] for r in rows])) if rows else 0.0,
    }
    print(f"✅ 2ª capa entrenada. MAE base={metrics['mae_base_avg']:.2f} → "
          f"corregido={metrics['mae_corregido_avg']:.2f} "
          f"({metrics['mejora_pct_avg']:+.1f}%)")
    return final, metrics


# ─────────────────────────────────────────────────────────────────────
# WALK-FORWARD VALIDATION
# ─────────────────────────────────────────────────────────────────────
def _make_estimator(use_xgb: bool):
    if use_xgb:
        from xgboost import XGBClassifier
        return XGBClassifier(
            n_estimators=300, max_depth=5, learning_rate=0.05,
            scale_pos_weight=5, eval_metric="logloss")
    from sklearn.ensemble import RandomForestClassifier
    return RandomForestClassifier(
        n_estimators=300, max_depth=10, min_samples_leaf=5,
        class_weight="balanced", n_jobs=-1, random_state=42)


def walk_forward(df: pd.DataFrame, target: str, feats: list, use_xgb: bool):
    from sklearn.metrics import precision_score, recall_score, f1_score
    years = sorted(df["year"].unique())
    rows = []
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
    # entrenar modelo final con TODO
    final = _make_estimator(use_xgb)
    final.fit(df[feats], df[target])
    return final, rows


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
                    help="Usar CSV local willay_hist.csv en vez de datasets Kaggle")
    ap.add_argument("--local-csv", default="willay_hist.csv")
    # parse_known_args en vez de parse_args: si el script se corre pegado en
    # una celda de Jupyter/Colab (en vez de "!python archivo.py"), el kernel
    # inyecta su propio argumento "-f kernel-xxx.json" y parse_args() truena
    # con "unrecognized arguments". Con parse_known_args() simplemente lo
    # ignoramos.
    args, _unknown = ap.parse_known_args()

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

    # 2) Features + targets (feats se calcula dinámicamente)
    feat_train, feats = build_features(df_train)
    print(f"📦 Train: {len(feat_train)} filas | features usadas: {feats}")
    print(f"   helada+={feat_train['helada_t3'].sum()} | "
          f"sequia+={feat_train['sequia_t3'].sum()}")

    if len(feat_train) == 0:
        sys.exit("❌ El dataset de entrenamiento quedó vacío tras el feature "
                  "engineering. Revisa que 'date', 't_min' y 'precip' tengan datos.")

    # 3) Walk-forward por año
    print("\n──── HELADA t+3 ────")
    m_hel, res_hel = walk_forward(feat_train, "helada_t3", feats, args.xgb)
    for r in res_hel: print(r)

    print("\n──── SEQUIA t+3 ────")
    m_seq, res_seq = walk_forward(feat_train, "sequia_t3", feats, args.xgb)
    for r in res_seq: print(r)

    def _avg(rs, k): return float(np.mean([r[k] for r in rs])) if rs else 0.0
    summary = {
        "modelo": "xgboost" if args.xgb else "random_forest",
        "horizonte_dias": HORIZONTE_DIAS,
        "features": feats,
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

    # 4) Validación final con dataset 2026 si está disponible
    if df_test is not None:
        feat_test, _ = build_features(df_test)
        # nos aseguramos de tener exactamente las columnas de entrenamiento
        faltantes = [c for c in feats if c not in feat_test.columns]
        if faltantes:
            print(f"⚠️  El dataset 2026 no tiene estas columnas de feature: "
                  f"{faltantes}. Se omite validación 2026.")
        elif len(feat_test) > 0:
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
        else:
            print("⚠️  El dataset 2026 quedó vacío tras el feature engineering. "
                  "Se omite validación 2026.")

    # 4b) 2ª capa · modelo del error (residual sensor−satélite)
    m_res, res_metrics = train_residual_model(feat_train)
    if res_metrics is not None:
        summary["residual_layer"] = res_metrics

    # 5) Guardar artefactos
    plot_results(res_hel, res_seq, PLOT_PATH)
    with open(REPORT_PATH, "w") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)
    print(f"📝 Reporte → {REPORT_PATH}")

    import pickle
    with open(MODEL_PATH, "wb") as f:
        pickle.dump({
            "kind": "rf_walkforward" if not args.xgb else "xgb_walkforward",
            "features": feats,
            "model_helada": m_hel,
            "model_sequia": m_seq,
            "model_residual": m_res,
            "residual_features": RESIDUAL_FEATURES,
            "report": summary,
            "trained_at": datetime.now(timezone.utc).isoformat(),
        }, f)
    print(f"✅ Modelo guardado → {MODEL_PATH}")
    print(f"   Descárgalo desde el panel de salida (Output) del notebook,")
    print(f"   o luego: scp {os.path.basename(MODEL_PATH)} pi@<ip>:/home/pi/")


if __name__ == "__main__":
    main()







# %% [code]
