import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Cpu,
  Radio,
  Server,
  Cloud,
  Smartphone,
  Antenna,
  BatteryCharging,
  Thermometer,
  Droplets,
  Sun,
  Layers,
  GitBranch,
  Network,
  AlertTriangle,
  CheckCircle2,
  Ruler,
} from "lucide-react";
import LanguageToggle from "@/components/LanguageToggle";

/**
 * /arquitectura
 * Nueva arquitectura WILLAY pedida por los profesores:
 *  - Nodos ESP32 + LoRa SX1278 distribuidos en campo (mesh).
 *  - Raspberry Pi como CONCENTRADOR central (no va en cada zona).
 *  - SIM800L / 2G solo en la Pi para subir a la nube.
 *  - Modelo explicable en DOS CAPAS (base satelital + ajuste de error con sensores).
 *  - Reentrenamiento mensual, alertas anticipadas (semanas / meses).
 */
const Arquitectura = () => {
  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="bg-primary text-primary-foreground p-5 rounded-b-3xl shadow-lg">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                to="/"
                className="p-2 rounded-xl bg-primary-foreground/20 hover:bg-primary-foreground/30"
                aria-label="Volver al inicio"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-xl font-extrabold">🏗️ Arquitectura WILLAY v4</h1>
                <p className="text-xs font-semibold opacity-80">
                  ESP32 + LoRa → Pi concentrador → 2G → Nube
                </p>
              </div>
            </div>
            <LanguageToggle />
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 mt-6 space-y-6">
        {/* Resumen */}
        <section className="rounded-2xl border-2 border-border bg-card p-5">
          <h2 className="text-base font-extrabold mb-2 flex items-center gap-2">
            <Network className="w-5 h-5 text-primary" /> Cambio clave
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            La <strong>Raspberry Pi ya no va en cada parcela</strong>. Es el
            <strong> concentrador central</strong>. En el campo se despliegan
            <strong> nodos ESP32 + LoRa SX1278</strong> (433&nbsp;MHz, 2–5&nbsp;km
            rurales) alimentados por <strong>batería + panel solar</strong>. Solo el
            concentrador usa <strong>SIM800L / 2G</strong> para subir a la nube.
          </p>
        </section>

        {/* Diagrama ASCII visual */}
        <section className="rounded-2xl border-2 border-border bg-card p-5">
          <h2 className="text-base font-extrabold mb-4 flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-accent" /> Diagrama de red
          </h2>

          <div className="space-y-4">
            {/* Capa nodos */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "N1", label: "Parcela A", dist: "0.4 km" },
                { id: "N2", label: "Parcela B", dist: "0.9 km" },
                { id: "N3", label: "Parcela C", dist: "1.6 km*" },
              ].map((n) => (
                <div
                  key={n.id}
                  className="rounded-xl border-2 border-frost/40 bg-frost/5 p-3 text-center"
                >
                  <Cpu className="w-6 h-6 mx-auto text-frost" />
                  <p className="text-xs font-extrabold mt-1">ESP32 {n.id}</p>
                  <p className="text-[10px] text-muted-foreground">{n.label}</p>
                  <p className="text-[10px] font-mono">{n.dist}</p>
                </div>
              ))}
            </div>

            <p className="text-center text-[10px] text-muted-foreground">
              * N3 fuera de rango directo → reenvía por <strong>N2</strong> (mesh LoRa)
            </p>

            {/* Flechas LoRa */}
            <div className="flex items-center justify-center gap-2 text-accent">
              <Radio className="w-4 h-4" />
              <span className="text-xs font-bold">LoRa 433 MHz · mesh ≤ 1 km/hop</span>
              <Radio className="w-4 h-4" />
            </div>

            {/* Concentrador */}
            <div className="rounded-2xl border-2 border-primary bg-primary/5 p-4 text-center">
              <div className="flex items-center justify-center gap-3">
                <Antenna className="w-6 h-6 text-primary" />
                <Server className="w-8 h-8 text-primary" />
                <Smartphone className="w-6 h-6 text-primary" />
              </div>
              <p className="text-sm font-extrabold mt-1">
                Raspberry Pi · CONCENTRADOR
              </p>
              <p className="text-[11px] text-muted-foreground">
                LoRa gateway + SIM800L 2G + modelo local + SMS
              </p>
              <p className="text-[10px] font-mono mt-1">
                Antena en alto (poste / árbol, no en la casa)
              </p>
            </div>

            {/* 2G */}
            <div className="flex items-center justify-center gap-2 text-warning">
              <Smartphone className="w-4 h-4" />
              <span className="text-xs font-bold">
                HTTPS sobre GPRS/2G (chip multioperador)
              </span>
            </div>

            {/* Nube */}
            <div className="rounded-2xl border-2 border-safe/60 bg-safe/5 p-4 text-center">
              <Cloud className="w-8 h-8 mx-auto text-safe" />
              <p className="text-sm font-extrabold mt-1">Lovable Cloud</p>
              <p className="text-[11px] text-muted-foreground">
                Edge functions · sensor_readings · entrenamiento mensual ·
                dashboard PWA
              </p>
            </div>
          </div>
        </section>

        {/* Nodo sensor */}
        <section className="rounded-2xl border-2 border-border bg-card p-5">
          <h2 className="text-base font-extrabold mb-3 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-frost" /> Anatomía del nodo de campo
          </h2>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <Cpu className="w-4 h-4 mt-0.5 text-frost" />
              <span>
                <strong>ESP32</strong> en modo <em>deep sleep</em>: despierta 1×
                por hora (o 1× al mes en campaña de bajo consumo).
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Radio className="w-4 h-4 mt-0.5 text-accent" />
              <span>
                <strong>LoRa SX1278 / RA-02</strong> (433 MHz, ~45 µA en idle)
                con pin <code className="text-xs">EN</code> para apagar al
                dormir.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Thermometer className="w-4 h-4 mt-0.5 text-danger" />
              <span>
                <strong>DHT22</strong> (aire: T y H) protegido bajo cubierta
                ventilada.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Droplets className="w-4 h-4 mt-0.5 text-frost" />
              <span>
                <strong>Sensor capacitivo de humedad de suelo</strong>{" "}
                <em>enterrado</em> (NO al aire) a 10–20 cm.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Sun className="w-4 h-4 mt-0.5 text-warning" />
                <BatteryCharging className="w-4 h-4 mt-0.5 text-safe" />
              <span>
                <strong>Batería LiFePO₄</strong> con fuente de alimentación
                eléctrica y regulador estable (LoRa es sensible al ruido eléctrico).
              </span>
            </li>
          </ul>
        </section>

        {/* Densidad de nodos */}
        <section className="rounded-2xl border-2 border-border bg-card p-5">
          <h2 className="text-base font-extrabold mb-3 flex items-center gap-2">
            <Ruler className="w-5 h-5 text-primary" /> ¿Cuántos nodos por
            hectárea?
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            La densidad sale del <strong>análisis de sensibilidad</strong> del
            modelo: si 2–3 °C de variación cambian la predicción, se necesitan
            más nodos.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-2">Fenómeno</th>
                  <th className="text-left p-2">Escala</th>
                  <th className="text-left p-2">Densidad sugerida</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-border">
                  <td className="p-2">❄️ Helada</td>
                  <td className="p-2">Regional (10–100 km²)</td>
                  <td className="p-2 font-mono">1 nodo / 5–10 ha</td>
                </tr>
                <tr className="border-t border-border">
                  <td className="p-2">💧 Humedad suelo</td>
                  <td className="p-2">Microparcela (m²)</td>
                  <td className="p-2 font-mono">1 nodo / 0.5–1 ha</td>
                </tr>
                <tr className="border-t border-border">
                  <td className="p-2">🌾 Calibración fina</td>
                  <td className="p-2">Paper IoT agro</td>
                  <td className="p-2 font-mono">grid cada ~8 m</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Justificación matemática vía <strong>interpolación espacial</strong>{" "}
            (kriging) — ver <Link to="/metodologia" className="underline">/metodologia</Link>.
          </p>
        </section>

        {/* Modelo dos capas */}
        <section className="rounded-2xl border-2 border-border bg-card p-5">
          <h2 className="text-base font-extrabold mb-3 flex items-center gap-2">
            <Layers className="w-5 h-5 text-accent" /> Modelo explicable de 2
            capas
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Cambia el enfoque: <strong>no avisar cuando ya baja la
            temperatura</strong>, sino predecir con <strong>semanas o meses
            de anticipación</strong>.
          </p>

          <div className="space-y-3">
            <div className="rounded-xl border-2 border-frost/40 bg-frost/5 p-3">
              <p className="text-sm font-extrabold flex items-center gap-2">
                <span className="bg-frost text-frost-foreground rounded-full w-6 h-6 grid place-items-center text-xs">
                  1
                </span>
                Modelo base (satélite)
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                <strong>Random Forest / XGBoost / SVM</strong> entrenado con
                Google Earth Engine (ERA5, MODIS, Sentinel-2 NDVI) — predicción
                primaria a 1–6 meses.
              </p>
              <p className="text-[11px] font-mono bg-muted p-2 rounded mt-2">
                ŷ_base = f_RF(NDVI, T_era5, P_era5, mes, lat, lon)
              </p>
            </div>

            <div className="text-center text-xs text-muted-foreground">
              ⬇ residuo = y_real − ŷ_base
            </div>

            <div className="rounded-xl border-2 border-warning/40 bg-warning/5 p-3">
              <p className="text-sm font-extrabold flex items-center gap-2">
                <span className="bg-warning text-warning-foreground rounded-full w-6 h-6 grid place-items-center text-xs">
                  2
                </span>
                Modelo de ajuste de error (sensores reales)
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Reentrena la <strong>diferencia</strong> entre Earth Engine y
                los nodos ESP32 (corrige sesgo local del microclima).
              </p>
              <p className="text-[11px] font-mono bg-muted p-2 rounded mt-2">
                ŷ_final = ŷ_base + g_RF(T_nodo, H_suelo, altitud, hora)
              </p>
            </div>

            <div className="rounded-xl border-2 border-safe/40 bg-safe/5 p-3 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-safe shrink-0" />
              <p className="text-xs">
                <strong>Reentrenamiento mensual</strong> automático (edge
                function + cron). Validación <strong>walk-forward por año</strong>{" "}
                con Recall / Precision / F1.
              </p>
            </div>
          </div>
        </section>

        {/* Alertas */}
        <section className="rounded-2xl border-2 border-border bg-card p-5">
          <h2 className="text-base font-extrabold mb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-warning" /> Alertas
            anticipadas
          </h2>
          <ul className="text-sm space-y-2">
            <li>📅 <strong>Mensual</strong> — ventana probable de heladas /
              sequía del mes siguiente.</li>
            <li>📆 <strong>Semanal</strong> — días de mayor riesgo a 3–7 días.</li>
            <li>📨 <strong>SMS Twilio</strong> — disparo inmediato si el modelo
              local de la Pi cruza el umbral aprendido por RL.</li>
          </ul>
        </section>

        {/* BOM */}
        <section className="rounded-2xl border-2 border-border bg-card p-5">
          <h2 className="text-base font-extrabold mb-3">🛒 Hardware a adquirir</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-2">Componente</th>
                  <th className="text-left p-2">Rol</th>
                  <th className="text-left p-2">Cant.</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["ESP32 DevKit", "MCU de cada nodo", "N"],
                  ["LoRa SX1278 / RA-02 (433 MHz)", "Radio mesh nodo↔Pi", "N+1"],
                  ["Antena LoRa alta ganancia", "Cobertura rural", "N+1"],
                  ["DHT22", "Temp + humedad aire", "N"],
                  ["Sensor humedad suelo capacitivo", "Enterrado 10-20 cm", "N"],
                  ["Batería LiFePO₄ 3.2 V + panel 5 W", "Autonomía nodo", "N"],
                  ["Raspberry Pi 4 + SIM800L", "Concentrador + 2G", "1"],
                  ["Poste / mástil 4–6 m", "Elevar antena", "1"],
                ].map(([c, r, q]) => (
                  <tr key={c} className="border-t border-border">
                    <td className="p-2 font-semibold">{c}</td>
                    <td className="p-2 text-muted-foreground">{r}</td>
                    <td className="p-2 font-mono">{q}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            <strong>N</strong> = nodos calculados según densidad (sección
            anterior). El profesor recalca que hay que invertir en hardware
            bien diseñado.
          </p>
        </section>

        <Link to="/metodologia">
          <div className="rounded-2xl border-2 border-dashed border-primary/30 p-4 flex items-center justify-center gap-3 hover:bg-primary/5 transition-colors cursor-pointer">
            <Layers className="w-5 h-5 text-primary" />
            <p className="text-sm font-bold">Ver ecuaciones del modelo →</p>
          </div>
        </Link>
      </main>
    </div>
  );
};

export default Arquitectura;