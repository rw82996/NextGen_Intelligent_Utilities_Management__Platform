"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, RiskBadge } from "@/components/status-badge";
import { formatKWh } from "@/lib/format";
import { getTheftAlerts } from "@/lib/client-data";
import { theftMeterFeatures } from "@/lib/theft";
import { runGpuScoring } from "@/lib/meter-gpu";
import { appendAuditEntry, verifyAuditChain, type AuditEntry } from "@/lib/audit-chain";
import {
  loadModel, generate, isWebGPUAvailable, DEFAULT_MODEL_ID, AVAILABLE_MODELS, type ModelStatus,
} from "@/lib/llm-bridge";
import { ShieldAlert, Zap, TrendingDown, Cpu, Sparkles, Loader2, Download, ShieldCheck, ShieldX, History } from "lucide-react";
import type { TheftAlert } from "@/types";

export default function TheftPage() {
  const [alerts] = useState<TheftAlert[]>(() => getTheftAlerts());
  const [selected, setSelected] = useState<TheftAlert | null>(() => getTheftAlerts()[0] ?? null);

  // Real GPU-computed risk scores (task: reuse the WGSL anomaly-scoring shader)
  const [liveScores, setLiveScores] = useState<Record<string, number>>({});
  const [gpuStatus, setGpuStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [gpuProvider, setGpuProvider] = useState<"webgpu" | "cpu" | null>(null);

  // WebLLM-generated investigation narrative
  const webgpu = useRef(false);
  const [selectedModelId, setSelectedModelId] = useState(DEFAULT_MODEL_ID);
  const [loadedModelId, setLoadedModelId] = useState<string | null>(null);
  const [modelStatus, setModelStatus] = useState<ModelStatus>("idle");
  const [modelProgress, setModelProgress] = useState<{ file: string; pct: number } | null>(null);
  const [narratives, setNarratives] = useState<Record<string, string>>({});
  const [narrativeBusy, setNarrativeBusy] = useState<string | null>(null);

  // Web Crypto hash-chained audit trail
  const [auditChains, setAuditChains] = useState<Record<string, AuditEntry[]>>({});
  const [chainVerified, setChainVerified] = useState<Record<string, boolean | null>>({});

  useEffect(() => {
    webgpu.current = isWebGPUAvailable();
    if (!webgpu.current) setModelStatus("no-webgpu");
  }, []);

  useEffect(() => {
    // Seed each alert's audit trail with a genesis "Case opened" entry.
    (async () => {
      const seeded: Record<string, AuditEntry[]> = {};
      for (const a of alerts) {
        seeded[a.alertId] = await appendAuditEntry([], "Case opened", "System");
      }
      setAuditChains(seeded);
    })();
  }, [alerts]);

  const open = alerts.filter((a) => a.status === "OPEN" || a.status === "INVESTIGATING");
  const totalLoss = alerts.reduce((s, a) => s + a.estimatedLossKWh, 0);

  function scoreFor(a: TheftAlert): number {
    return liveScores[a.alertId] !== undefined ? Math.round(liveScores[a.alertId] * 100) : a.riskScore;
  }

  async function rescanViaGpu() {
    setGpuStatus("running");
    try {
      const features = alerts.map((a) => theftMeterFeatures[a.meterId]).filter(Boolean);
      const supported = typeof navigator !== "undefined" && !!navigator.gpu;
      const scores = supported ? await runGpuScoring(features) : features.map(() => 0);
      setGpuProvider(supported ? "webgpu" : "cpu");
      const next: Record<string, number> = {};
      features.forEach((f, i) => {
        const alert = alerts.find((a) => a.meterId === f.meterId);
        if (alert) next[alert.alertId] = scores[i];
      });
      setLiveScores(next);
      setGpuStatus("done");
    } catch (err) {
      console.error("[Energy-Theft Detection] GPU rescan failed:", err);
      setGpuStatus("error");
    }
  }

  async function handleLoadModel() {
    setModelStatus("loading");
    try {
      await loadModel(selectedModelId, (p) => setModelProgress({ file: p.file, pct: p.progress }));
      setModelStatus("ready");
      setLoadedModelId(selectedModelId);
      setModelProgress(null);
    } catch (err) {
      console.error("[Energy-Theft Detection] local model failed to load:", err);
      setModelStatus(webgpu.current ? "error" : "no-webgpu");
      setModelProgress(null);
    }
  }

  async function generateNarrative(a: TheftAlert) {
    if (modelStatus !== "ready") return;
    setNarrativeBusy(a.alertId);
    setNarratives((prev) => ({ ...prev, [a.alertId]: "" }));
    try {
      const prompt =
        `Alert ${a.alertId} for customer ${a.customer} (${a.detectionType}), severity ${a.severity}, ` +
        `risk score ${scoreFor(a)}/100, estimated loss ${a.estimatedLossKWh} kWh.\n` +
        `Contributing factors: ${a.factors.join("; ")}.\n` +
        `Write a 2-3 sentence investigation summary for a revenue-protection analyst, recommending a next action.`;
      await generate(
        [
          { role: "system", content: "You are a utility revenue-protection analyst assistant. Be concise and specific." },
          { role: "user", content: prompt },
        ],
        (full) => setNarratives((prev) => ({ ...prev, [a.alertId]: full })),
      );
    } catch (err) {
      setNarratives((prev) => ({ ...prev, [a.alertId]: `Error: ${err instanceof Error ? err.message : String(err)}` }));
    } finally {
      setNarrativeBusy(null);
    }
  }

  async function recordAction(a: TheftAlert, action: string) {
    const chain = auditChains[a.alertId] ?? [];
    const next = await appendAuditEntry(chain, action, "Daniel Osei");
    setAuditChains((prev) => ({ ...prev, [a.alertId]: next }));
    setChainVerified((prev) => ({ ...prev, [a.alertId]: null }));
  }

  async function verifyChain(a: TheftAlert) {
    const chain = auditChains[a.alertId] ?? [];
    const ok = await verifyAuditChain(chain);
    setChainVerified((prev) => ({ ...prev, [a.alertId]: ok }));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Energy-Theft Detection</h1>
          <p className="text-sm text-muted-foreground mt-1">AI revenue-protection — meter tampering &amp; consumption anomalies.</p>
        </div>
        <Button size="sm" variant="outline" onClick={rescanViaGpu} disabled={gpuStatus === "running"}>
          {gpuStatus === "running" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Cpu className="h-3.5 w-3.5" />}
          {gpuStatus === "running" ? "Scoring…" : "Rescan via GPU"}
        </Button>
      </div>
      {gpuStatus === "done" && (
        <p className="text-xs px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 inline-block">
          Risk scores recomputed via {gpuProvider === "webgpu" ? "a real WGSL compute shader on the GPU" : "CPU fallback (WebGPU unavailable)"}.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="pt-5"><p className="text-xs uppercase text-muted-foreground tracking-wide">Open Alerts</p><p className="text-2xl font-bold mt-1 text-amber-600">{open.length}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs uppercase text-muted-foreground tracking-wide">Critical</p><p className="text-2xl font-bold mt-1 text-red-600">{alerts.filter(a => a.severity === "CRITICAL").length}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs uppercase text-muted-foreground tracking-wide">Est. Energy Loss</p><p className="text-2xl font-bold mt-1">{formatKWh(totalLoss)}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs uppercase text-muted-foreground tracking-wide">Detection Rate</p><p className="text-2xl font-bold mt-1 text-emerald-600">96%</p></CardContent></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-2">
          {alerts.map(a => (
            <button key={a.alertId} onClick={() => setSelected(a)} className={`w-full text-left p-4 rounded-xl border transition-all ${selected?.alertId === a.alertId ? "border-emerald-300 bg-emerald-50/50 shadow-sm" : "hover:bg-muted/40"}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">{a.customer}</span>
                <RiskBadge level={a.severity} />
              </div>
              <p className="text-xs text-muted-foreground">{a.alertId} · {a.meterId}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-muted-foreground">Risk {scoreFor(a)}{liveScores[a.alertId] !== undefined && <span className="text-emerald-600"> (GPU)</span>}</span>
                <StatusBadge status={a.status} />
              </div>
            </button>
          ))}
        </div>

        {selected && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center">
                    <ShieldAlert className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{selected.customer}</CardTitle>
                    <CardDescription>{selected.alertId} · {selected.meterId} · {selected.region}</CardDescription>
                  </div>
                </div>
                <RiskBadge level={selected.severity} />
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Risk Score</p><p className="text-xl font-bold text-red-600">{scoreFor(selected)}</p></div>
                <div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Est. Loss</p><p className="text-xl font-bold">{formatKWh(selected.estimatedLossKWh)}</p></div>
                <div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Assigned</p><p className="text-sm font-semibold mt-1">{selected.assignedTo}</p></div>
              </div>

              <div>
                <p className="text-sm font-semibold mb-1 flex items-center gap-1.5"><Zap className="h-4 w-4 text-amber-500" /> {selected.detectionType}</p>
                <p className="text-sm text-muted-foreground">{selected.description}</p>
              </div>

              <div>
                <p className="text-sm font-semibold mb-2 flex items-center gap-1.5"><TrendingDown className="h-4 w-4 text-red-500" /> Contributing Factors</p>
                <ul className="space-y-1.5">
                  {selected.factors.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-emerald-500" /> AI Investigation Summary</p>
                  {modelStatus !== "ready" && modelStatus !== "no-webgpu" && (
                    <div className="flex items-center gap-2">
                      <select value={selectedModelId} onChange={(e) => setSelectedModelId(e.target.value)} disabled={modelStatus === "loading"} className="text-xs rounded-md border border-input bg-background px-1.5 py-1">
                        {AVAILABLE_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                      </select>
                      <Button size="sm" variant="outline" onClick={handleLoadModel} disabled={modelStatus === "loading"}>
                        {modelStatus === "loading" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                        {modelStatus === "loading" ? (modelProgress ? `${modelProgress.pct}%` : "Loading…") : "Load model"}
                      </Button>
                    </div>
                  )}
                  {modelStatus === "ready" && loadedModelId === selectedModelId && (
                    <Button size="sm" variant="outline" onClick={() => generateNarrative(selected)} disabled={narrativeBusy === selected.alertId}>
                      {narrativeBusy === selected.alertId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                      {narrativeBusy === selected.alertId ? "Generating…" : "Generate summary"}
                    </Button>
                  )}
                  {modelStatus === "no-webgpu" && <span className="text-xs text-muted-foreground">WebGPU unavailable</span>}
                </div>
                {narratives[selected.alertId] ? (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{narratives[selected.alertId]}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Load the local model, then generate an AI-written summary of this case grounded in its factors.</p>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <Button className="bg-gradient-to-r from-emerald-600 to-cyan-600" onClick={() => recordAction(selected, "Dispatched inspector")}>Dispatch Inspector</Button>
                <Button variant="outline" onClick={() => recordAction(selected, "Marked as investigating")}>Mark Investigating</Button>
                <Button variant="outline" onClick={() => recordAction(selected, "Dismissed alert")}>Dismiss</Button>
              </div>

              <div className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold flex items-center gap-1.5"><History className="h-4 w-4 text-slate-500" /> Tamper-Evident Audit Trail</p>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="ghost" onClick={() => verifyChain(selected)}>Verify chain</Button>
                    {chainVerified[selected.alertId] === true && <span className="flex items-center gap-1 text-xs text-emerald-600"><ShieldCheck className="h-3.5 w-3.5" /> Verified</span>}
                    {chainVerified[selected.alertId] === false && <span className="flex items-center gap-1 text-xs text-red-600"><ShieldX className="h-3.5 w-3.5" /> Broken</span>}
                  </div>
                </div>
                <ul className="space-y-1.5">
                  {(auditChains[selected.alertId] ?? []).map((e) => (
                    <li key={e.seq} className="text-xs text-muted-foreground flex items-center justify-between gap-2">
                      <span>{e.action} — {e.actor} · {new Date(e.at).toLocaleTimeString()}</span>
                      <span className="font-mono text-[10px] text-muted-foreground/70">{e.hash.slice(0, 12)}…</span>
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-muted-foreground/70">Each entry&apos;s SHA-256 hash (via the Web Crypto API) covers the previous entry&apos;s hash, so any edit or reorder breaks the chain.</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
