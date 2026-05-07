import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import ZoomableImage from "@/components/ZoomableImage";
import matrizMorfologica from "@/assets/matriz-morfologica.png";

const team = [
  {
    name: "Brigitte Bernal Belisario",
    role: "🎯 Líder del Equipo / CTO",
    skills: "Arquitectura de software, integración de IA, ciberseguridad, coordinación técnica",
    img: "https://github.com/user-attachments/assets/f5e4e18a-ede9-4790-a543-4c4fc53b4651",
  },
  {
    name: "Sergio Salazar León",
    role: "🔬 Responsable de Investigación",
    skills: "Validación ambiental, gestión de datos climáticos, análisis de impacto",
    img: "https://github.com/user-attachments/assets/eb6ef572-0b34-4c32-b1a0-8fd54ac42467",
  },
  {
    name: "José Pereira Velasque",
    role: "🎨 Diseñador UX/UI",
    skills: "Prototipado, experiencia de usuario, diseño de interfaces accesibles",
    img: "https://github.com/user-attachments/assets/94f00231-8488-4b4a-abeb-dda75b65e74c",
  },
  {
    name: "Mayory Turin",
    role: "📊 Analista de Datos",
    skills: "Procesamiento de señales, modelos predictivos, validación estadística",
    img: "https://github.com/user-attachments/assets/ea288c55-b2a0-4e43-9b20-7f89abbfa6d0",
  },
];

const exigencias = [
  { t: "Función Principal", d: "Plataforma inteligente de alerta temprana de heladas y sequías para zonas andinas, integrando IoT, datos satelitales y IA." },
  { t: "Geometría", d: "Dispositivo IoT compacto, resistente a viento, lluvia, UV y granizo. Carcasa inoxidable con membrana anti-condensación." },
  { t: "Señales", d: "Entrada: temperatura, humedad relativa, humedad de suelo, GPS. Salida: alertas SMS/push ES-QU, dashboard, exportación CSV/PDF." },
  { t: "Control", d: "Umbrales configurables por cultivo y zona. Alertas escalonadas (advertencia → alerta → emergencia). Series históricas 5-10 años." },
  { t: "Hardware", d: "Microcontrolador con sensores calibrados, batería + panel solar, protección contra sobretensión y polaridad inversa." },
  { t: "Software", d: "App móvil/web offline-first (ISO 9241-210). Mapa interactivo, predicciones a 10 meses, exportación multi-formato." },
  { t: "Comunicación", d: "Sensor-app ≥10 m, WiFi/celular en gateway, protocolo MQTT (ISO/IEC 20922) con arquitectura distribuida." },
  { t: "Ergonomía", d: "Interfaz bilingüe ES/QU, alto contraste, navegación ≤3 toques, 4 LEDs de estado y botón de emergencia." },
  { t: "Calidad", d: "ISO 9001, ISO 14001, ISO 20816-1. Calibración con error <5%. Pruebas de campo en zonas piloto." },
  { t: "Capacitación", d: "Tutorial en video para agricultores y técnicos rurales sobre uso del sistema e interpretación de predicciones." },
];

type Slide = {
  id: string;
  title: string;
  subtitle?: string;
  render: () => JSX.Element;
};

const slides: Slide[] = [
  {
    id: "portada",
    title: "WILLAY",
    subtitle: "Sistema Inteligente de Alerta Temprana de Heladas y Sequías para Agricultura Andina",
    render: () => (
      <div className="flex flex-col items-center justify-center text-center gap-6 h-full">
        <div className="text-8xl">🌾❄️</div>
        <h1 className="text-7xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-frost bg-clip-text text-transparent">
          WILLAY
        </h1>
        <p className="text-2xl text-muted-foreground max-w-3xl">
          Sistema Inteligente de Alerta Temprana de Heladas y Sequías
          <br />para Agricultura Andina 🇵🇪
        </p>
        <div className="flex gap-3 flex-wrap justify-center mt-4">
          <span className="px-4 py-2 rounded-full bg-primary/10 text-primary font-bold">IoT</span>
          <span className="px-4 py-2 rounded-full bg-frost/10 text-frost font-bold">Satélite</span>
          <span className="px-4 py-2 rounded-full bg-accent/10 text-accent font-bold">IA</span>
          <span className="px-4 py-2 rounded-full bg-safe/10 text-safe font-bold">Bilingüe ES/QU</span>
        </div>
        <p className="text-sm text-muted-foreground mt-8">Equipo 04 · Proyectos de Ingeniería I · UPCH</p>
        <div className="mt-4 flex flex-col items-center gap-2">
          <ZoomableImage
            src="https://www.gob.mx/cms/uploads/article/main_image/127099/ODS_13._Acci_n_por_el_clima.jpg"
            alt="ODS 13 - Acción por el clima"
            className="h-28 w-auto rounded-lg shadow-md"
          />
          <p className="text-xs font-bold text-muted-foreground">Alineado con ODS 13: Acción por el clima</p>
        </div>
      </div>
    ),
  },
  {
    id: "equipo",
    title: "01. Sobre Nosotros",
    render: () => (
      <div className="grid grid-cols-2 gap-6">
        {team.map((m) => (
          <div key={m.name} className="rounded-2xl border-2 border-border p-5 flex gap-4 bg-card hover:shadow-lg transition-shadow">
            <img src={m.img} alt={m.name} className="w-20 h-20 rounded-full object-cover border-2 border-primary" />
            <div className="flex-1">
              <h3 className="font-extrabold text-lg">{m.name}</h3>
              <p className="text-sm font-bold text-primary">{m.role}</p>
              <p className="text-xs text-muted-foreground mt-1">{m.skills}</p>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "problema",
    title: "02. Definición del Problema",
    subtitle: "Mapa de Empatía del Agricultor Andino",
    render: () => (
      <div className="space-y-4">
        <p className="text-lg text-muted-foreground">
          Los agricultores andinos pierden hasta el <b className="text-danger">70% de sus cultivos</b> por heladas y sequías
          imprevistas. La falta de información climática hiperlocal y oportuna agrava la inseguridad alimentaria.
        </p>
        <ZoomableImage
          src="https://raw.githubusercontent.com/Fx2048/PI_Equipo04/main/Recursos/Imagenes/Mapa_de_Empatia.jpg"
          alt="Mapa de Empatía"
          className="max-h-[55vh] w-auto mx-auto rounded-2xl border-2 border-border shadow-md object-contain"
        />
        <div className="flex flex-col items-center gap-1">
          <img
            src="https://www.gob.mx/cms/uploads/article/main_image/127099/ODS_13._Acci_n_por_el_clima.jpg"
            alt="ODS 13 - Acción por el clima"
            className="h-24 w-auto rounded-lg shadow-md"
          />
          <p className="text-xs font-bold text-muted-foreground">ODS 13: Acción por el clima</p>
        </div>
      </div>
    ),
  },
  {
    id: "contexto",
    title: "03. Contexto",
    subtitle: "Realidad climática de la sierra peruana",
    render: () => (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-2xl bg-frost/10 border-2 border-frost/30 p-4 text-center">
            <p className="text-4xl font-extrabold text-frost">-15°C</p>
            <p className="text-sm font-bold mt-1">Temperaturas mínimas en sierra sur</p>
          </div>
          <div className="rounded-2xl bg-drought/10 border-2 border-drought/30 p-4 text-center">
            <p className="text-4xl font-extrabold text-drought">+40%</p>
            <p className="text-sm font-bold mt-1">Reducción de lluvias proyectada al 2050</p>
          </div>
          <div className="rounded-2xl bg-danger/10 border-2 border-danger/30 p-4 text-center">
            <p className="text-4xl font-extrabold text-danger">2.5M</p>
            <p className="text-sm font-bold mt-1">Agricultores afectados por heladas/año</p>
          </div>
        </div>
        <ZoomableImage
          src="https://raw.githubusercontent.com/Fx2048/PI_Equipo04/main/Recursos/Imagenes/Captura%20de%20pantalla%202026-05-05%20141556.png"
          alt="Contexto climático"
          className="max-h-[40vh] w-auto mx-auto rounded-2xl border-2 border-border shadow-md object-contain"
          onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
        />
      </div>
    ),
  },
  {
    id: "exigencias",
    title: "04. Lista de Exigencias",
    subtitle: "Requerimientos del sistema WILLAY",
    render: () => (
      <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-2">
        {exigencias.map((e, i) => (
          <div key={i} className="rounded-xl border-2 border-border p-4 bg-card">
            <p className="font-extrabold text-primary text-sm">{e.t}</p>
            <p className="text-xs text-muted-foreground mt-1">{e.d}</p>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "caja-negra",
    title: "05. Caja Negra y Esquema de Funciones",
    subtitle: "Análisis funcional del sistema",
    render: () => (
      <div className="space-y-3 max-h-[60vh] overflow-y-auto">
        <h3 className="font-bold text-lg">📦 Caja Negra</h3>
        <div className="flex flex-col gap-4 items-center">
          {[
            "https://github.com/user-attachments/assets/793d1135-7048-4ad3-a12b-2f8da52dd615",
            "https://github.com/user-attachments/assets/85952b1b-1cba-4d0f-afe7-2edb7e7d8208",
            "https://github.com/user-attachments/assets/ab4e6792-945f-4c56-af3d-469fa09d7b2a",
          ].map((src, i) => (
            <ZoomableImage key={i} src={src} alt={`Caja negra ${i + 1}`} className="max-h-[55vh] w-auto max-w-full rounded-xl border-2 border-border object-contain" />
          ))}
        </div>
        <h3 className="font-bold text-lg mt-4">🔧 Esquema de Funciones</h3>
        <ZoomableImage
          src="https://github.com/user-attachments/assets/d5e3bd33-12fe-4204-b5b2-b9f4ad7ff29b"
          alt="Esquema de funciones"
          className="max-h-[55vh] w-auto max-w-full mx-auto rounded-xl border-2 border-border object-contain"
        />
      </div>
    ),
  },
  {
    id: "morfologica",
    title: "06. Matriz Morfológica",
    subtitle: "Combinación de soluciones técnicas",
    render: () => (
      <ZoomableImage
        src={matrizMorfologica}
        alt="Matriz morfológica"
        className="max-h-[60vh] w-auto max-w-full mx-auto rounded-2xl border-2 border-border shadow-md object-contain"
      />
    ),
  },
  {
    id: "estado-arte",
    title: "07. Estado del Arte",
    subtitle: "Patentes, artículos y apps similares",
    render: () => {
      const patentes = [
        {
          tag: "Patente · US20230176247A1",
          title: "Frost prediction system and method",
          desc: "Sensores ambientales in situ (temperatura, humedad, atmósfera) procesados con algoritmos predictivos para estimar riesgo de escarcha y emitir alertas anticipadas.",
          imgs: [
            "https://github.com/user-attachments/assets/2cea1bbc-ed44-435e-aeea-42f34ba3237a",
            "https://github.com/user-attachments/assets/c438d94b-9a25-4421-8da7-6cac467a0a66",
          ],
        },
        {
          tag: "Patente · CN204990626U",
          title: "Sistema de difusión de alerta temprana para heladas y granizo",
          desc: "Red de difusión que distribuye alertas tempranas de heladas y granizo a comunidades agrícolas.",
          imgs: [
            "https://github.com/user-attachments/assets/a59d02c4-5541-4239-8a05-37ad2f9a06bb",
            "https://github.com/user-attachments/assets/11ee5fae-50f7-4564-b840-06a76cd2f22e",
          ],
        },
        {
          tag: "Patente · CN202195972U",
          title: "Soil gas collector — sequía y ciclos congelación-descongelación",
          desc: "Recolector de gases del suelo para baja temperatura, sequía y humedad. Cámara colectora hermética con control de presión, temperatura y estanqueidad.",
          imgs: ["https://github.com/user-attachments/assets/72a69e80-1525-4998-be7f-a363d412ec72"],
        },
        {
          tag: "Patente · US10728336B2",
          title: "Integrated IoT system for smart agriculture",
          desc: "Red de sensores en campo (T°, HR, humedad de suelo, radiación) con nodos inalámbricos. Modelos predictivos sobre series temporales para heladas y déficit hídrico.",
          imgs: [
            "https://github.com/user-attachments/assets/e5bd5c03-0d2e-41fc-90f8-5a92410004d4",
            "https://github.com/user-attachments/assets/05b0e281-e3ae-407f-8709-dc3181d793ba",
          ],
        },
        {
          tag: "Patente · US12417532B2",
          title: "Detección temprana de estrés hídrico en plantas",
          desc: "Vehículo remoto con sensores RGB e infrarrojo radiométrico. Combina dosel + humedad de suelo + CWSI en una red neuronal para detectar sequía temprana.",
          imgs: [
            "https://github.com/user-attachments/assets/43697872-b3e8-44e8-9cbf-67e8e46f463e",
            "https://github.com/user-attachments/assets/992ca862-f784-47d8-b149-60f8e3e4ab60",
          ],
        },
      ];
      const articulos = [
        {
          tag: "Artículo",
          title: "Frost Prediction Using Machine Learning and Deep Neural Network",
          desc: "DNN sobre datos meteorológicos (Alcalde, Nuevo México). Supera a métodos tradicionales en horizontes de 6–48 h.",
          imgs: [
            "https://github.com/user-attachments/assets/4f043ab0-7214-44b5-9ab9-aa21e862ba10",
            "https://github.com/user-attachments/assets/0ada45a5-f1df-4a21-b1b1-d406cf45153a",
          ],
        },
        {
          tag: "Artículo",
          title: "Intelligent Frost Forecasting and Warning System (IFFS)",
          desc: "WSN + deep learning para pronosticar helada radiativa 3 h antes. F-score ≈96 %, exactitud de alerta 100 %.",
          imgs: [
            "https://github.com/user-attachments/assets/2737bca9-b84a-413a-9d13-e6dfcdb03a2e",
            "https://github.com/user-attachments/assets/9ea4942f-da6b-4fc8-8ad7-6f66910e828e",
          ],
        },
        {
          tag: "Artículo",
          title: "Wireless Sensors Network for Monitoring and Predicting Droughts",
          desc: "Red inalámbrica de sensores suelo/clima → estación base → nube. Alertas por SMS/correo. Caso Nueva Zelanda.",
          imgs: [
            "https://github.com/user-attachments/assets/efd33898-89ae-41d2-bead-2169b8150926",
            "https://github.com/user-attachments/assets/2462d84d-2a08-4b0f-a943-b7da058668b5",
          ],
        },
      ];
      const apps = [
        {
          tag: "App",
          title: "Apps de monitoreo y alerta temprana (SENAMHI)",
          desc: "Vitrina virtual para pronóstico de eventos extremos: lluvias, vientos, bajas temperaturas, heladas y friajes.",
          imgs: [
            "https://github.com/user-attachments/assets/bb0ac9bc-3063-4385-b134-6623d01b120e",
            "https://github.com/user-attachments/assets/30df4f5c-ec73-4975-9538-2c28b874b19b",
          ],
        },
      ];
      const Card = ({ tag, title, desc, imgs }: { tag: string; title: string; desc: string; imgs: string[] }) => (
        <div className="rounded-2xl border-2 border-border p-4 space-y-2 bg-card">
          <span className="inline-block text-[10px] font-extrabold uppercase tracking-wider bg-primary/10 text-primary px-2 py-0.5 rounded-full">
            {tag}
          </span>
          <h3 className="font-extrabold text-sm leading-tight">{title}</h3>
          <p className="text-xs text-muted-foreground">{desc}</p>
          <div className={`grid gap-2 ${imgs.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
            {imgs.map((src, i) => (
              <ZoomableImage key={i} src={src} alt="" className="rounded-lg w-full object-contain max-h-48 bg-muted/30" />
            ))}
          </div>
        </div>
      );
      return (
        <div className="max-h-[62vh] overflow-y-auto pr-2 space-y-5">
          <div>
            <h4 className="font-extrabold text-sm text-frost mb-2">📜 Patentes</h4>
            <div className="grid grid-cols-2 gap-3">
              {patentes.map((p) => <Card key={p.title} {...p} />)}
            </div>
          </div>
          <div>
            <h4 className="font-extrabold text-sm text-drought mb-2">📄 Artículos científicos</h4>
            <div className="grid grid-cols-2 gap-3">
              {articulos.map((p) => <Card key={p.title} {...p} />)}
            </div>
          </div>
          <div>
            <h4 className="font-extrabold text-sm text-primary mb-2">📱 Apps de referencia</h4>
            <div className="grid grid-cols-2 gap-3">
              {apps.map((p) => <Card key={p.title} {...p} />)}
            </div>
          </div>
        </div>
      );
    },
  },
  {
    id: "bocetos",
    title: "08. Bocetos y Modelado 3D",
    subtitle: "Diseño mecánico del dispositivo",
    render: () => (
      <div className="space-y-4">
        <ZoomableImage
          src="https://github.com/user-attachments/assets/d8241139-7864-4c63-9586-643e576ba71a"
          alt="Boceto inicial"
          className="rounded-xl border-2 border-border max-h-[35vh] w-auto max-w-full mx-auto object-contain"
        />
        <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="font-bold mb-2">🛡️ Protector del proyecto</p>
          <ZoomableImage src="https://github.com/user-attachments/assets/4352745f-80a1-4d49-b52b-4963255489d6" alt="Protector" className="rounded-xl border-2 border-border max-h-[45vh] w-auto max-w-full mx-auto object-contain" />
          <a
            href="https://3dviewer.net/#model=https://raw.githubusercontent.com/Fx2048/PI_Equipo04/main/Recursos/Archivos/cuerpo.iges"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary font-bold mt-2 hover:underline"
          >
            Ver modelo 3D del cuerpo <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <div>
          <p className="font-bold mb-2">🔝 Tapa del protector</p>
          <ZoomableImage src="https://github.com/user-attachments/assets/5c60abc9-6f93-436f-9ea4-32b38eb0766a" alt="Tapa" className="rounded-xl border-2 border-border max-h-[45vh] w-auto max-w-full mx-auto object-contain" />
          <a
            href="https://3dviewer.net/#model=https://raw.githubusercontent.com/Fx2048/PI_Equipo04/main/Recursos/Archivos/tapa.iges"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary font-bold mt-2 hover:underline"
          >
            Ver modelo 3D de la tapa <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        </div>
      </div>
    ),
  },
  {
    id: "diseno-detalle",
    title: "08b. Diseño de Detalle",
    subtitle: "Esquemático, placa y vista 3D del PCB",
    render: () => (
      <div className="grid grid-cols-3 gap-4 max-h-[65vh]">
        <div className="flex flex-col">
          <p className="font-bold mb-2 text-center">📐 Esquemático</p>
          <ZoomableImage
            src="https://github.com/user-attachments/assets/b514fb3b-0c08-470c-b968-4b73de40a499"
            alt="Esquemático"
            className="rounded-xl border-2 border-border w-full object-contain max-h-[55vh] bg-muted/20"
          />
        </div>
        <div className="flex flex-col">
          <p className="font-bold mb-2 text-center">🔌 Placa PCB</p>
          <ZoomableImage
            src="https://github.com/user-attachments/assets/c030f877-c72e-4537-91c0-225de51a11e5"
            alt="Placa PCB"
            className="rounded-xl border-2 border-border w-full object-contain max-h-[55vh] bg-muted/20"
          />
        </div>
        <div className="flex flex-col">
          <p className="font-bold mb-2 text-center">🧊 Vista 3D del PCB</p>
          <ZoomableImage
            src="https://github.com/user-attachments/assets/1ff6b5c3-3485-4f61-9ee7-8c7c9ae89daa"
            alt="Vista 3D del PCB"
            className="rounded-xl border-2 border-border w-full object-contain max-h-[55vh] bg-muted/20"
          />
        </div>
      </div>
    ),
  },
  {
    id: "protocolo",
    title: "09. Protocolo de Validación",
    subtitle: "Procedimiento experimental",
    render: () => (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {[
            { n: "1", t: "Calibración", d: "Sensores contra patrones certificados (error <5%)" },
            { n: "2", t: "Pruebas en laboratorio", d: "Cámara climática controlada, condiciones extremas" },
            { n: "3", t: "Pruebas de campo", d: "Lomas de Pachacamac, zonas piloto altoandinas" },
            { n: "4", t: "Validación predictiva", d: "Comparación predicción vs. medición real" },
          ].map((p) => (
            <div key={p.n} className="rounded-2xl border-2 border-primary/30 p-4 bg-card">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground font-extrabold flex items-center justify-center">
                  {p.n}
                </div>
                <p className="font-extrabold">{p.t}</p>
              </div>
              <p className="text-sm text-muted-foreground mt-2">{p.d}</p>
            </div>
          ))}
        </div>
        <a
          href="https://github.com/Fx2048/PI_Equipo04/blob/main/Proyectos_de_ingenieria1/Entregables/09.%20Protocolo_PI1.md"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-primary font-bold hover:underline"
        >
          Ver protocolo completo en GitHub <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    ),
  },
  {
    id: "esquematico",
    title: "10. Esquemático y Placa",
    subtitle: "Diseño electrónico del nodo IoT",
    render: () => (
      <div className="grid grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-2">
        <div className="col-span-2">
          <ZoomableImage src="https://github.com/user-attachments/assets/e66de41d-02d8-4b8b-8942-ee7b6d9352f5" alt="Esquemático" className="rounded-xl border-2 border-border max-h-[45vh] w-auto max-w-full mx-auto object-contain" />
        </div>
        <ZoomableImage src="https://github.com/user-attachments/assets/a979b486-7b90-47e3-849e-836b51f8d904" alt="Placa" className="rounded-xl border-2 border-border max-h-[40vh] w-auto max-w-full mx-auto object-contain" />
        <ZoomableImage src="https://github.com/user-attachments/assets/8d34a02d-a001-4541-9466-2a9e38911d0c" alt="PCB 3D" className="rounded-xl border-2 border-border max-h-[40vh] w-auto max-w-full mx-auto object-contain" />
      </div>
    ),
  },
  {
    id: "visualizacion",
    title: "11. Visualización de Datos",
    subtitle: "Demo en vivo de la plataforma WILLAY",
    render: () => (
      <div className="flex flex-col items-center justify-center text-center gap-6 h-full">
        <div className="text-7xl">📊🌾</div>
        <h2 className="text-4xl font-extrabold">¡Pasemos a la demo!</h2>
        <p className="text-lg text-muted-foreground max-w-2xl">
          Dashboard interactivo con alertas hiperlocales, predicciones a 10 meses,
          mapa NDVI satelital y soporte bilingüe Español/Quechua.
        </p>
        <a href="https://cultiva-seguro.lovable.app/" target="_blank" rel="noreferrer">
          <Button size="lg" className="text-lg px-8 py-6 rounded-2xl">
            🚀 Abrir WILLAY en vivo <ExternalLink className="w-5 h-5 ml-2" />
          </Button>
        </a>
        <p className="text-xs text-muted-foreground mt-4">cultiva-seguro.lovable.app</p>
      </div>
    ),
  },
  {
    id: "gracias",
    title: "¡Gracias!",
    render: () => (
      <div className="flex flex-col items-center justify-center text-center gap-6 h-full">
        <div className="text-8xl">🙏🌾</div>
        <h1 className="text-6xl font-extrabold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          ¡Gracias!
        </h1>
        <p className="text-2xl text-muted-foreground">Sullpayki · Yusulpayki</p>
        <p className="text-base text-muted-foreground max-w-xl mt-4">
          Equipo 04 — Brigitte Bernal · Sergio Salazar · Mayory Turin · José Pereira
        </p>
      </div>
    ),
  },
];

const Presentacion = () => {
  const [i, setI] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") setI((p) => Math.min(p + 1, slides.length - 1));
      if (e.key === "ArrowLeft") setI((p) => Math.max(p - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const slide = slides[i];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="bg-primary text-primary-foreground px-6 py-3 flex items-center justify-between shadow-md">
        <h1 className="font-extrabold text-lg">🌾 WILLAY · Presentación</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm font-bold">
            {i + 1} / {slides.length}
          </span>
          <div className="flex gap-1">
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setI(idx)}
                className={`w-2 h-2 rounded-full transition-all ${
                  idx === i ? "bg-primary-foreground w-6" : "bg-primary-foreground/40"
                }`}
              />
            ))}
          </div>
        </div>
      </header>

      {/* Slide */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-8 py-8 flex flex-col">
        <div className="mb-6">
          <h2 className="text-4xl font-extrabold tracking-tight">{slide.title}</h2>
          {slide.subtitle && <p className="text-lg text-muted-foreground mt-1">{slide.subtitle}</p>}
        </div>
        <div className="flex-1">{slide.render()}</div>
      </main>

      {/* Nav */}
      <footer className="px-6 py-4 flex justify-between items-center border-t border-border bg-card">
        <Button variant="outline" onClick={() => setI((p) => Math.max(p - 1, 0))} disabled={i === 0}>
          <ChevronLeft className="w-4 h-4" /> Anterior
        </Button>
        <p className="text-xs text-muted-foreground">
          Usa ← → o la barra espaciadora
        </p>
        <Button onClick={() => setI((p) => Math.min(p + 1, slides.length - 1))} disabled={i === slides.length - 1}>
          Siguiente <ChevronRight className="w-4 h-4" />
        </Button>
      </footer>
    </div>
  );
};

export default Presentacion;