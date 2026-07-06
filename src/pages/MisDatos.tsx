import { useState, useEffect, useMemo, useCallback } from "react";
import { ArrowLeft, Download, Search, Trash2, RefreshCw, Database, HardDrive } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { willayDB, type SensorReading } from "@/lib/indexedDB";
import { exportSensorsCSV, exportSensorsJSON, exportSensorsPDF, exportAlertsCSV, exportAlertsJSON, type ExportFormat, type ExportDataType } from "@/lib/exportData";
import { syncToCloud, pullFromCloud, getTimeSinceSync, getStorageUsage } from "@/lib/syncManager";
import { useConnectivity } from "@/hooks/useConnectivity";
import ConnectivityBadge from "@/components/ConnectivityBadge";
import LanguageToggle from "@/components/LanguageToggle";
import { useLanguage } from "@/i18n/LanguageContext";
import SimulatedCharts from "@/components/SimulatedCharts";

const PAGE_SIZE = 25;

// Intervalo de polling en background. 60s es un balance razonable entre
// "datos frescos" y no gastar batería/datos móviles innecesariamente.
// Si necesitas algo más agresivo (ej. monitoreo activo de una helada en curso),
// considera exponerlo como un toggle explícito de "modo tiempo real" en vez
// de bajarlo por defecto para todos los usuarios.
const POLL_INTERVAL_MS = 60000;

const MisDatos = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { isOnline, justReconnected } = useConnectivity();
  const [sensors, setSensors] = useState<SensorReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("csv");
  const [exportType, setExportType] = useState<ExportDataType>("sensors");
  const [exporting, setExporting] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [filterZone, setFilterZone] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);

  // Storage stats
  const [sensorCount, setSensorCount] = useState(0);
  const [storageUsage, setStorageUsage] = useState({ usedKB: 0, percentUsed: 0 });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await willayDB.getSensorReadings();
      setSensors(data.sort((a, b) => b.timestamp - a.timestamp));
      setSensorCount(data.length);
      setStorageUsage(getStorageUsage());
    } catch {
      toast({ title: "Error", description: "No se pudieron cargar los datos", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  // Sync inicial al montar la página (solo si hay conexión en ese momento)
  useEffect(() => {
    const initSync = async () => {
      if (isOnline) {
        await pullFromCloud();
        await loadData();
      }
    };

    initSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Polling en background: cada POLL_INTERVAL_MS, solo si hay conexión
  // y la pestaña/app está visible (evita gastar datos/batería en segundo plano).
  useEffect(() => {
    if (!isOnline) return;

    const interval = setInterval(async () => {
      if (document.visibilityState === "visible") {
        await pullFromCloud();
        await loadData();
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isOnline, loadData]);

  // Auto-sync on reconnect
  useEffect(() => {
    if (justReconnected && isOnline) {
      handleSync();
    }
  }, [justReconnected, isOnline]);

  const zones = useMemo(() => {
    const set = new Set(sensors.map((s) => s.device_id));
    return Array.from(set).sort();
  }, [sensors]);

  const filtered = useMemo(() => {
    let result = sensors;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.device_id.toLowerCase().includes(q) ||
          r.alerta?.toLowerCase().includes(q) ||
          String(r.temperatura).includes(q)
      );
    }
    if (filterZone !== "all") result = result.filter((r) => r.device_id === filterZone);
    if (dateFrom) {
      const from = new Date(dateFrom).getTime();
      result = result.filter((r) => r.timestamp >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo).getTime() + 86400000;
      result = result.filter((r) => r.timestamp < to);
    }
    return result;
  }, [sensors, search, filterZone, dateFrom, dateTo]);

  const paged = useMemo(() => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [filtered, page]);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const handleSync = async () => {
    setSyncing(true);
    try {
      if (isOnline) {
        const pulled = await pullFromCloud();
        const pushed = await syncToCloud();
        await loadData();
        toast({
          title: "🛰️ Sincronizado",
          description: `Descargados: ${pulled.sensors + pulled.smsLogs} | Subidos: ${pushed.synced}`,
        });
      } else {
        toast({ title: "📴 Sin conexión", description: "Los datos se sincronizarán al reconectar", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Fallo en la sincronización", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      if (exportType === "sensors") {
        const data = filtered.length > 0 ? filtered : sensors;
        if (exportFormat === "csv") exportSensorsCSV(data);
        else if (exportFormat === "json") exportSensorsJSON(data);
        else exportSensorsPDF(data);
      } else {
        const logs = await willayDB.getSMSLogs();
        if (exportFormat === "csv") exportAlertsCSV(logs);
        else exportAlertsJSON(logs);
      }
      toast({ title: "✅ Datos exportados", description: `Formato: ${exportFormat.toUpperCase()}` });
      setExportOpen(false);
    } catch {
      toast({ title: "❌ Error", description: "No se pudieron exportar los datos", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const handleCleanup = async () => {
    if (!confirm("¿Eliminar datos de más de 6 meses? Se mantendrán los últimos 1000 registros.")) return;
    const deleted = await willayDB.cleanupSensors();
    await willayDB.cleanupNDVI();
    await willayDB.cleanupSMSLogs();
    await loadData();
    toast({ title: "🧹 Limpieza completada", description: `${deleted} registros antiguos eliminados` });
  };
  

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });

  const alertBadge = (alerta: string | null) => {
    if (!alerta) return null;
    const variant = alerta === "helada" ? "destructive" : alerta === "sequía" ? "outline" : "secondary";
    return <Badge variant={variant} className="text-xs">{alerta === "helada" ? "❄️" : "⚠️"} {alerta}</Badge>;
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <header className="bg-primary text-primary-foreground p-4 rounded-b-3xl shadow-lg">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/20">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-extrabold">📊 {t("data.title")}</h1>
              <p className="text-xs opacity-80">{getTimeSinceSync()}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ConnectivityBadge isOnline={isOnline} justReconnected={justReconnected} />
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSync}
              disabled={syncing}
              className="text-primary-foreground hover:bg-primary-foreground/20"
            >
              <RefreshCw className={`w-5 h-5 ${syncing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </header>
      
      <main className="max-w-2xl mx-auto px-4 mt-5 space-y-4">
        {/* Storage info */}
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-sm font-bold">
                <HardDrive className="w-4 h-4" />
                {t("data.local_storage")}
              </div>
              <span className="text-xs text-muted-foreground">{storageUsage.usedKB} KB / 5 MB</span>
            </div>
            <Progress value={storageUsage.percentUsed} className="h-2" />
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Database className="w-3 h-3" /> {sensorCount} {t("data.records")}
              </span>
              {storageUsage.percentUsed > 80 && (
                <Badge variant="destructive" className="text-xs">⚠️ {storageUsage.percentUsed}%</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4 pb-3 space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={t("data.search")}
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                  className="pl-9 h-9"
                />
              </div>
              <Select value={filterZone} onValueChange={(v) => { setFilterZone(v); setPage(0); }}>
                <SelectTrigger className="w-36 h-9">
                  <SelectValue placeholder="Zona" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {zones.map((z) => (
                    <SelectItem key={z} value={z}>{z}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(0); }} className="h-9 text-xs" placeholder="Desde" />
              <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(0); }} className="h-9 text-xs" placeholder="Hasta" />
            </div>
          </CardContent>
        </Card>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button onClick={() => setExportOpen(true)} className="flex-1 gap-2 font-bold">
            <Download className="w-4 h-4" /> {t("data.export")} ({filtered.length})
          </Button>
          <Button variant="outline" onClick={handleCleanup} className="gap-2">
            <Trash2 className="w-4 h-4" /> {t("data.cleanup")}
          </Button>
        </div>

        {/* Charts */}
        {filtered.length > 0 && <SimulatedCharts readings={filtered} />}

        {/* Data table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span>{t("data.sensor_readings")}</span>
              <span className="text-xs font-normal text-muted-foreground">{filtered.length}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">...</div>
            ) : paged.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Database className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="font-bold">{t("data.no_data")}</p>
                <p className="text-xs mt-1">{t("data.no_data_desc")}</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">{t("data.date")}</TableHead>
                        <TableHead className="text-xs">{t("data.zone")}</TableHead>
                        <TableHead className="text-xs">{t("data.temp")}</TableHead>
                        <TableHead className="text-xs">{t("data.humidity")}</TableHead>
                        <TableHead className="text-xs">{t("data.soil")}</TableHead>
                        <TableHead className="text-xs">{t("data.alert")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paged.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="text-xs whitespace-nowrap">{formatDate(r.timestamp)}</TableCell>
                          <TableCell className="text-xs font-medium">{r.device_id}</TableCell>
                          <TableCell className="text-xs">{r.temperatura != null ? `${r.temperatura}°C` : "-"}</TableCell>
                          <TableCell className="text-xs">{r.humedad_aire != null ? `${r.humedad_aire}%` : "-"}</TableCell>
                          <TableCell className="text-xs">{r.humedad_suelo != null ? `${r.humedad_suelo}%` : "-"}</TableCell>
                          <TableCell>{alertBadge(r.alerta)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between p-3 border-t">
                    <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                      ← {t("data.previous")}
                    </Button>
                    <span className="text-xs text-muted-foreground">{page + 1} / {totalPages}</span>
                    <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                      {t("data.next")} →
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Export Dialog */}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>📥 {t("data.export_title")}</DialogTitle>
            <DialogDescription>{t("data.export_desc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-bold mb-1 block">{t("data.data_type")}</label>
              <Select value={exportType} onValueChange={(v) => setExportType(v as ExportDataType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sensors">📡 {t("data.sensors")}</SelectItem>
                  <SelectItem value="alerts">📨 {t("data.sms_alerts")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-bold mb-1 block">{t("data.format")}</label>
              <div className="flex gap-2">
                {(["csv", "json", ...(exportType === "sensors" ? ["pdf" as const] : [])] as ExportFormat[]).map((f) => (
                  <Button
                    key={f}
                    variant={exportFormat === f ? "default" : "outline"}
                    onClick={() => setExportFormat(f)}
                    className="flex-1 font-bold"
                  >
                    {f.toUpperCase()}
                  </Button>
                ))}
              </div>
            </div>
            {exporting && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">⏳ Exportando...</p>
                <Progress value={60} className="h-2" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportOpen(false)}>{t("data.cancel")}</Button>
            <Button onClick={handleExport} disabled={exporting} className="gap-2 font-bold">
              <Download className="w-4 h-4" /> {t("data.download")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MisDatos;
