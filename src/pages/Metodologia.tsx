import { Link } from "react-router-dom";
import { ArrowLeft, Info, BarChart3, Thermometer, Droplets, Leaf, AlertTriangle, CheckCircle } from "lucide-react";

const Metodologia = () => {
  return (
    <div className="min-h-screen bg-background pb-8">
      <header className="bg-primary text-primary-foreground p-5 rounded-b-3xl shadow-lg">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            <Link to="/" className="p-2 rounded-xl bg-primary-foreground/20 hover:bg-primary-foreground/30">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-extrabold">📐 Metodología WILLAY</h1>
              <p className="text-xs font-semibold opacity-80">Transparencia científica · Modelo v3</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 mt-6 space-y-5">
        {/* Modelo de Heladas */}
        <section className="rounded-2xl border-2 border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Thermometer className="w-5 h-5 text-frost" />
            <h2 className="text-base font-extrabold text-foreground">❄️ Modelo de Heladas (Multi-Factor)</h2>
          </div>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="p-3 rounded-xl bg-frost/5 border border-frost/20">
              <p className="font-bold text-foreground mb-1">Fórmula Principal:</p>
              <p className="font-mono text-xs bg-muted p-2 rounded-lg">
                P(helada) = Φ((Umbral_cultivo − μ_aire) / σ_aire) × 100 + Σ factores
              </p>
              <p className="mt-2 text-xs">
                Donde <strong>Φ</strong> es la función de distribución acumulada normal (CDF), 
                <strong> μ_aire</strong> es el promedio histórico de temperatura nocturna corregida, y 
                <strong> σ_aire</strong> es la desviación estándar (mín 1.5°C).
              </p>
            </div>

            <div>
              <p className="font-bold text-foreground mb-2">Factores Agravantes:</p>
              <ul className="space-y-1.5">
                <li className="flex items-start gap-2">
                  <span className="text-danger font-bold text-xs mt-0.5">+25%</span>
                  <span className="text-xs"><strong>Duración:</strong> ≥2 días consecutivos bajo umbral de cultivo</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-danger font-bold text-xs mt-0.5">+20%</span>
                  <span className="text-xs"><strong>Etapa sensible:</strong> Floración (máxima vulnerabilidad)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-warning font-bold text-xs mt-0.5">+15%</span>
                  <span className="text-xs"><strong>Humedad suelo baja:</strong> Precipitación &lt;20mm (suelo seco = más vulnerable)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-warning font-bold text-xs mt-0.5">+10%</span>
                  <span className="text-xs"><strong>Vegetación débil:</strong> NDVI &lt;0.25 (cultivo estresado)</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Umbrales por Cultivo */}
        <section className="rounded-2xl border-2 border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Leaf className="w-5 h-5 text-safe" />
            <h2 className="text-base font-extrabold text-foreground">🌱 Umbrales por Cultivo</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 font-extrabold text-foreground">Cultivo</th>
                  <th className="text-center py-2 font-extrabold text-foreground">Floración</th>
                  <th className="text-center py-2 font-extrabold text-foreground">Vegetativo</th>
                  <th className="text-center py-2 font-extrabold text-foreground">Tuberc.</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b border-border/50">
                  <td className="py-2 font-bold">🥔 Papa</td>
                  <td className="text-center font-bold text-danger">-1°C</td>
                  <td className="text-center font-bold text-warning">-1.5°C</td>
                  <td className="text-center font-bold text-frost">-2°C</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 font-bold">🌽 Maíz</td>
                  <td className="text-center font-bold text-danger">0°C</td>
                  <td className="text-center font-bold text-warning">-0.5°C</td>
                  <td className="text-center text-muted-foreground">—</td>
                </tr>
                <tr>
                  <td className="py-2 font-bold">🌾 Quinua</td>
                  <td className="text-center font-bold text-danger">-2°C</td>
                  <td className="text-center font-bold text-warning">-1.5°C</td>
                  <td className="text-center text-muted-foreground">—</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            📌 Si no seleccionas cultivo, se usa umbral genérico: 0°C (floración/vegetativo).
          </p>
        </section>

        {/* Modelo de Sequía */}
        <section className="rounded-2xl border-2 border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Droplets className="w-5 h-5 text-drought" />
            <h2 className="text-base font-extrabold text-foreground">🌵 Modelo de Sequía (SPI)</h2>
          </div>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="p-3 rounded-xl bg-drought/5 border border-drought/20">
              <p className="font-bold text-foreground mb-1">Fórmula:</p>
              <p className="font-mono text-xs bg-muted p-2 rounded-lg">
                SPI = (P_mes − μ_global) / σ_global
              </p>
              <p className="mt-2 text-xs">
                Índice de Precipitación Estandarizado (<strong>McKee et al. 1993</strong>). Compara la precipitación 
                esperada contra el promedio histórico de todos los meses.
              </p>
            </div>

            <div>
              <p className="font-bold text-foreground mb-2">Clasificación:</p>
              <div className="space-y-1">
                {[
                  { spi: "SPI > 0", label: "Sin sequía", prob: "5%", color: "text-safe" },
                  { spi: "-0.5 a 0", label: "Ligeramente seco", prob: "15%", color: "text-muted-foreground" },
                  { spi: "-1.0 a -0.5", label: "Sequía leve", prob: "35%", color: "text-warning" },
                  { spi: "-1.5 a -1.0", label: "Sequía moderada", prob: "55%", color: "text-warning" },
                  { spi: "-2.0 a -1.5", label: "Sequía severa", prob: "75%", color: "text-danger" },
                  { spi: "SPI < -2.0", label: "Sequía extrema", prob: "90%", color: "text-danger" },
                ].map(row => (
                  <div key={row.spi} className="flex items-center justify-between text-xs px-2 py-1 rounded-lg bg-muted/50">
                    <span className="font-mono font-bold">{row.spi}</span>
                    <span className={`font-bold ${row.color}`}>{row.label}</span>
                    <span className="font-bold">{row.prob}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Fuentes de Datos */}
        <section className="rounded-2xl border-2 border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Info className="w-5 h-5 text-primary" />
            <h2 className="text-base font-extrabold text-foreground">🛰️ Fuentes de Datos</h2>
          </div>
          <div className="space-y-2">
            {[
              { name: "MODIS MOD11A2", desc: "Temperatura superficial (LST). NASA Terra/Aqua. 1km, cada 8 días.", correction: "Corrección: +3.5°C para convertir LST nocturna → temp del aire en altiplano andino" },
              { name: "MODIS MOD13A2", desc: "Índice de Vegetación (NDVI). 250m (resampled a 1km), cada 16 días.", correction: "Rango: -1 a 1. Vegetación sana: >0.3. Suelo desnudo: <0.1" },
              { name: "CHIRPS", desc: "Precipitación diaria. Climate Hazards Group. 5km resolución.", correction: "Combina datos satelitales infrarrojos + estaciones meteorológicas terrestres" },
            ].map(source => (
              <div key={source.name} className="p-3 rounded-xl bg-muted/50 border border-border">
                <p className="text-xs font-extrabold text-foreground">{source.name}</p>
                <p className="text-[11px] text-muted-foreground">{source.desc}</p>
                <p className="text-[10px] text-muted-foreground italic mt-1">💡 {source.correction}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Métricas de Precisión */}
        <section className="rounded-2xl border-2 border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h2 className="text-base font-extrabold text-foreground">📈 Precisión del Modelo</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-3">Validación histórica 2021-2026, región Puno:</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-frost/10 border border-frost/20 text-center">
              <p className="text-xs font-bold text-muted-foreground mb-1">❄️ Heladas</p>
              <p className="text-lg font-extrabold text-frost">78.3%</p>
              <p className="text-[10px] text-muted-foreground">Precisión</p>
              <p className="text-lg font-extrabold text-frost mt-1">90.0%</p>
              <p className="text-[10px] text-muted-foreground">Recall (sensibilidad)</p>
            </div>
            <div className="p-3 rounded-xl bg-drought/10 border border-drought/20 text-center">
              <p className="text-xs font-bold text-muted-foreground mb-1">🌵 Sequías</p>
              <p className="text-lg font-extrabold text-drought">83.3%</p>
              <p className="text-[10px] text-muted-foreground">Precisión</p>
              <p className="text-lg font-extrabold text-drought mt-1">88.2%</p>
              <p className="text-[10px] text-muted-foreground">Recall (sensibilidad)</p>
            </div>
          </div>

          <div className="mt-3 p-3 rounded-xl bg-muted/50">
            <p className="text-xs font-bold text-foreground">🔍 ¿Qué significa?</p>
            <ul className="text-[11px] text-muted-foreground mt-1 space-y-0.5">
              <li>• <strong>Precisión:</strong> De las alertas emitidas, % que fueron correctas</li>
              <li>• <strong>Recall:</strong> De los eventos reales, % que fueron detectados</li>
              <li>• Alto recall (90%) = pocos eventos de helada pasan sin alerta</li>
            </ul>
          </div>
        </section>

        {/* Factores que afectan la precisión */}
        <section className="rounded-2xl border-2 border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-warning" />
            <h2 className="text-base font-extrabold text-foreground">⚠️ Limitaciones</h2>
          </div>
          <div className="space-y-2">
            {[
              { icon: "☁️", title: "Cobertura nubosa", desc: "Puede afectar lecturas satelitales de MODIS. En días nublados, LST puede tener gaps." },
              { icon: "🏔️", title: "Microclimas locales", desc: "Un valle puede ser 3-5°C más frío que la ladera cercana. El satélite promedia 1km²." },
              { icon: "🌱", title: "Etapa del cultivo", desc: "La misma temperatura afecta diferente según la etapa. Floración = máxima vulnerabilidad." },
              { icon: "📡", title: "Resolución temporal", desc: "MODIS cada 8 días, no diario. Eventos puntuales pueden no ser capturados." },
            ].map(item => (
              <div key={item.title} className="flex items-start gap-2 p-2 rounded-xl bg-warning/5">
                <span className="text-lg">{item.icon}</span>
                <div>
                  <p className="text-xs font-bold text-foreground">{item.title}</p>
                  <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Recomendación final */}
        <section className="rounded-2xl border-2 border-safe bg-safe/10 p-5">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-5 h-5 text-safe" />
            <h2 className="text-base font-extrabold text-foreground">💡 Recomendación</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            "Para máxima precisión, combina WILLAY con <strong>observación directa</strong> de tus cultivos y, 
            si es posible, instala un <strong>sensor IoT local</strong>. Ningún sistema es 100% preciso, 
            pero WILLAY maximiza tu capacidad de preparación."
          </p>
          <div className="mt-3 p-3 rounded-xl bg-card border border-border">
            <p className="text-xs font-bold text-foreground">Niveles de Confianza:</p>
            <div className="flex items-center gap-3 mt-1">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-safe/20 text-safe border border-safe">ALTO</span>
              <span className="text-[10px] text-muted-foreground">0-3 meses · Datos recientes · Alta fiabilidad</span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-warning/20 text-warning border border-warning">MEDIO</span>
              <span className="text-[10px] text-muted-foreground">3-6 meses · Proyección moderada</span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-danger/20 text-danger border border-danger">BAJO</span>
              <span className="text-[10px] text-muted-foreground">6-10 meses · Alta incertidumbre</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Metodologia;
