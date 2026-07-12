"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Radio, RefreshCw, Wifi, WifiOff, Zap, AlertCircle, Activity } from "lucide-react";
import { telemetrySeed, type TelemetryChannel } from "@/lib/edge";

function jitter(ch: TelemetryChannel): TelemetryChannel {
  const swing = ch.channelId === "FREQ" ? 0.05 : ch.nominal * 0.06;
  const value = Number((ch.value + (Math.random() - 0.5) * swing).toFixed(ch.channelId === "FREQ" ? 3 : 1));
  const dev = Math.abs(value - ch.nominal) / (ch.nominal || 1);
  const status: TelemetryChannel["status"] =
    ch.channelId === "TX-N-14" ? (value > 82 ? "ALARM" : "WARNING")
    : dev > 0.08 ? "WARNING"
    : "NORMAL";
  return { ...ch, value, status, updatedAt: new Date().toISOString() };
}

const statusColors: Record<string, string> = {
  NORMAL: "bg-emerald-100 text-emerald-700",
  WARNING: "bg-amber-100 text-amber-700",
  ALARM: "bg-red-100 text-red-700",
};

export default function LiveTelemetryPage() {
  const [tradChannels, setTradChannels] = useState<TelemetryChannel[]>(() => telemetrySeed.map(c => ({ ...c })));
  const [tradLoading, setTradLoading] = useState(false);
  const [tradLastRefresh, setTradLastRefresh] = useState<string | null>(null);
  const [tradRefreshCount, setTradRefreshCount] = useState(0);

  const [sseChannels, setSseChannels] = useState<TelemetryChannel[]>(() => telemetrySeed.map(c => ({ ...c })));
  const [sseConnected, setSseConnected] = useState(true);
  const [sseEventCount, setSseEventCount] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const liveRef = useRef<TelemetryChannel[]>(telemetrySeed.map(c => ({ ...c })));

  const fetchTraditional = useCallback(async () => {
    setTradLoading(true);
    await new Promise(r => setTimeout(r, 300 + Math.random() * 500));
    setTradChannels(sseChannels.map(c => ({ ...c })));
    setTradLastRefresh(new Date().toLocaleTimeString());
    setTradRefreshCount(c => c + 1);
    setTradLoading(false);
  }, [sseChannels]);

  useEffect(() => {
    // In-browser telemetry simulator (replaces the server SSE stream so the
    // app runs fully client-side on static hosting / GitHub Pages).
    const interval = setInterval(() => {
      const chans = liveRef.current;
      if (chans.length === 0) return;
      const idx = Math.floor(Math.random() * chans.length);
      const updated = jitter(chans[idx]);
      const next = chans.map((c, i) => (i === idx ? updated : c));
      liveRef.current = next;
      setSseChannels(next);
      setSseEventCount(c => c + 1);
      setLastUpdate(new Date().toLocaleTimeString());
      setFlashId(updated.channelId);
      setTimeout(() => setFlashId(null), 800);
    }, 1500);

    return () => { clearInterval(interval); setSseConnected(false); };
  }, []);

  const staleCount = sseChannels.filter(c => {
    const t = tradChannels.find(x => x.channelId === c.channelId);
    return t && t.value !== c.value;
  }).length;

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Real-Time Grid Telemetry</h1>
        <p className="text-muted-foreground text-sm">Traditional polling vs Server-Sent Events (SSE) live SCADA stream</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 text-xs">
          <div className={`h-2 w-2 rounded-full ${sseConnected ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
          {sseConnected ? "SSE Connected" : "Disconnected"}
        </div>
        <div className="text-xs text-muted-foreground">{sseEventCount} telemetry events received</div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 border">
            <WifiOff className="h-5 w-5 text-slate-400" />
            <div className="flex-1"><div className="font-semibold text-sm">Traditional — REST Polling</div><div className="text-xs text-muted-foreground">Click refresh to fetch latest state</div></div>
            <button onClick={fetchTraditional} disabled={tradLoading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-xs font-medium transition-colors disabled:opacity-50">
              <RefreshCw className={`h-3 w-3 ${tradLoading ? "animate-spin" : ""}`} /> Refresh
            </button>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>Last refresh: {tradLastRefresh ?? "never"}</span><span>{tradRefreshCount} API calls made</span>
          </div>
          <div className="space-y-3">
            {tradChannels.map(c => {
              const live = sseChannels.find(s => s.channelId === c.channelId);
              return <ChannelCard key={c.channelId} channel={c} stale={live ? live.value !== c.value : false} />;
            })}
            {tradChannels.length === 0 && <EmptyState label="Waiting for connection..." />}
          </div>
          <div className="rounded-xl border border-dashed p-4 text-center space-y-1">
            <AlertCircle className="h-5 w-5 mx-auto text-slate-300" />
            <div className="text-xs text-muted-foreground">{staleCount > 0 ? `${staleCount} channel(s) already changed — click Refresh to see` : "Data shows last-refresh snapshot"}</div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200">
            <Wifi className="h-5 w-5 text-emerald-500" />
            <div className="flex-1"><div className="font-semibold text-sm text-emerald-900">Advanced — Server-Sent Events</div><div className="text-xs text-emerald-600">Live stream — telemetry arrives instantly</div></div>
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-200 text-emerald-800 text-xs font-mono"><Radio className="h-3 w-3 animate-pulse" /> LIVE</div>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>Last update: {lastUpdate ?? "connecting..."}</span><span>{sseEventCount} real-time events</span>
          </div>
          <div className="space-y-3">
            {sseChannels.map(c => <ChannelCard key={c.channelId} channel={c} flash={flashId === c.channelId} variant="sse" />)}
            {sseChannels.length === 0 && <EmptyState label="Connecting to SSE stream..." />}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-6 space-y-3">
        <div className="flex items-center gap-2 font-semibold"><Zap className="h-5 w-5 text-emerald-500" /> Technical Architecture</div>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="p-4 rounded-xl bg-slate-50 border space-y-1"><div className="font-medium">Traditional Polling</div><div className="text-xs text-muted-foreground">Client calls <code className="px-1 bg-slate-200 rounded">GET /api/telemetry</code> every N seconds. Wastes bandwidth; misses transients between polls.</div></div>
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1"><div className="font-medium text-emerald-900">SSE Streaming</div><div className="text-xs text-emerald-700">Single persistent <code className="px-1 bg-emerald-100 rounded">EventSource</code>. Server pushes each telemetry tick via <code className="px-1 bg-emerald-100 rounded">text/event-stream</code>.</div></div>
          <div className="p-4 rounded-xl bg-cyan-50 border border-cyan-200 space-y-1"><div className="font-medium text-cyan-900">Why It Matters</div><div className="text-xs text-cyan-700">Frequency excursions and transformer temperature alarms surface in milliseconds — critical for grid stability and protection.</div></div>
        </div>
      </div>
    </div>
  );
}

function ChannelCard({ channel, flash, stale, variant = "traditional" }: { channel: TelemetryChannel; flash?: boolean; stale?: boolean; variant?: "traditional" | "sse" }) {
  const dev = channel.nominal ? Math.min(Math.abs(channel.value - channel.nominal) / channel.nominal * 100, 100) : 0;
  return (
    <div className={`rounded-xl border p-4 space-y-3 transition-all duration-500 ${flash ? "ring-2 ring-emerald-400 bg-emerald-50/50 scale-[1.01]" : "bg-white"} ${stale ? "opacity-60 border-amber-300" : ""} ${variant === "sse" ? "border-l-4 border-l-emerald-400" : "border-l-4 border-l-slate-300"}`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm font-medium">{channel.name}</span>
            {stale && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">STALE</span>}
          </div>
          <span className="font-mono text-[11px] text-muted-foreground">{channel.channelId}</span>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold tabular-nums">{channel.value.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">{channel.unit}</span></div>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusColors[channel.status]}`}>{channel.status}</span>
        </div>
      </div>
      <div className="space-y-1">
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-700 ${channel.status === "ALARM" ? "bg-red-500" : channel.status === "WARNING" ? "bg-amber-400" : "bg-gradient-to-r from-emerald-400 to-cyan-500"}`} style={{ width: `${Math.max(dev * 4, 6)}%` }} />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>Nominal {channel.nominal.toLocaleString()} {channel.unit}</span>
          <span>{dev.toFixed(1)}% deviation</span>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="flex flex-col items-center justify-center py-12 text-muted-foreground space-y-2 rounded-xl border border-dashed"><Radio className="h-6 w-6 text-slate-300 animate-pulse" /><span className="text-sm">{label}</span></div>;
}
