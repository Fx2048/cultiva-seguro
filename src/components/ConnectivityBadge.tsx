import { Wifi, WifiOff, RefreshCw } from "lucide-react";

interface ConnectivityBadgeProps {
  isOnline: boolean;
  justReconnected: boolean;
}

const ConnectivityBadge = ({ isOnline, justReconnected }: ConnectivityBadgeProps) => {
  if (justReconnected) {
    return (
      <div className="flex items-center gap-1.5 bg-green-500/20 text-green-300 rounded-full px-3 py-1 text-xs font-bold animate-pulse">
        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
        🛰️ Conectado
      </div>
    );
  }

  if (!isOnline) {
    return (
      <div className="flex items-center gap-1.5 bg-red-500/30 text-red-200 rounded-full px-3 py-1 text-xs font-bold animate-pulse">
        <WifiOff className="w-3.5 h-3.5" />
        📡 Sin conexión
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 bg-primary-foreground/15 rounded-full px-2.5 py-1 text-xs font-bold opacity-70">
      <Wifi className="w-3.5 h-3.5" />
      En línea
    </div>
  );
};

export default ConnectivityBadge;
