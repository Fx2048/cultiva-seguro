import type { SensorReading, SMSLogRecord } from "./indexedDB";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatDate(ts: number | string): string {
  const d = new Date(typeof ts === "string" ? ts : ts);
  return d.toLocaleDateString("es-PE", { year: "numeric", month: "2-digit", day: "2-digit" }) +
    " " + d.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
}

function maskPhone(phone: string): string {
  if (phone.length <= 4) return "****";
  return phone.slice(0, -4).replace(/./g, "*") + phone.slice(-4);
}

// CSV export
export function exportSensorsCSV(data: SensorReading[], filename?: string) {
  const headers = "Fecha,Zona,Temp (°C),Humedad (%),Suelo (%),NDVI,Alerta,Sincronizado";
  const rows = data.map((r) =>
    [
      formatDate(r.timestamp),
      r.device_id,
      r.temperatura ?? "",
      r.humedad_aire ?? "",
      r.humedad_suelo ?? "",
      r.ndvi ?? "",
      r.alerta ?? "",
      r.sincronizado ? "Sí" : "No",
    ].join(",")
  );
  const csv = "\uFEFF" + [headers, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, filename || `willay_sensores_${new Date().toISOString().split("T")[0]}.csv`);
}

export function exportAlertsCSV(data: SMSLogRecord[], filename?: string) {
  const headers = "Fecha,Teléfono,Tipo,Ubicación,Temp,Estado,Mensaje";
  const rows = data.map((r) =>
    [
      formatDate(r.created_at),
      maskPhone(r.phone_number),
      r.alert_type,
      r.location_name ?? "",
      r.temperatura ?? "",
      r.status,
      `"${(r.message || "").replace(/"/g, '""')}"`,
    ].join(",")
  );
  const csv = "\uFEFF" + [headers, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, filename || `willay_alertas_${new Date().toISOString().split("T")[0]}.csv`);
}

// JSON export
export function exportSensorsJSON(data: SensorReading[], filename?: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  downloadBlob(blob, filename || `willay_sensores_${new Date().toISOString().split("T")[0]}.json`);
}

export function exportAlertsJSON(data: SMSLogRecord[], filename?: string) {
  const safe = data.map((r) => ({ ...r, phone_number: maskPhone(r.phone_number) }));
  const blob = new Blob([JSON.stringify(safe, null, 2)], { type: "application/json" });
  downloadBlob(blob, filename || `willay_alertas_${new Date().toISOString().split("T")[0]}.json`);
}

// PDF export (simple HTML-based)
export function exportSensorsPDF(data: SensorReading[], filename?: string) {
  const title = "WILLAY - Reporte de Sensores";
  const date = new Date().toLocaleDateString("es-PE");
  const tableRows = data
    .map(
      (r) => `<tr>
      <td>${formatDate(r.timestamp)}</td>
      <td>${r.device_id}</td>
      <td>${r.temperatura ?? "-"}</td>
      <td>${r.humedad_aire ?? "-"}</td>
      <td>${r.humedad_suelo ?? "-"}</td>
      <td>${r.alerta ?? "-"}</td>
    </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>${title}</title>
    <style>
      body{font-family:Arial,sans-serif;margin:20px;font-size:11px}
      h1{color:#22c55e;font-size:18px}
      table{width:100%;border-collapse:collapse;margin-top:12px}
      th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}
      th{background:#22c55e;color:white}
      tr:nth-child(even){background:#f9f9f9}
      .meta{color:#666;font-size:10px;margin-bottom:8px}
    </style></head><body>
    <h1>🌾 ${title}</h1>
    <p class="meta">Generado: ${date} | Total: ${data.length} registros</p>
    <table><thead><tr>
      <th>Fecha</th><th>Zona</th><th>Temp (°C)</th><th>Humedad (%)</th><th>Suelo (%)</th><th>Alerta</th>
    </tr></thead><tbody>${tableRows}</tbody></table>
  </body></html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank");
  if (w) {
    w.onload = () => {
      w.print();
      URL.revokeObjectURL(url);
    };
  }
}

export type ExportFormat = "csv" | "json" | "pdf";
export type ExportDataType = "sensors" | "alerts";
