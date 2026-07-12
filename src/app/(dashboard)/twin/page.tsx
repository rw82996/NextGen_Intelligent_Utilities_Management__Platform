"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, Play, Zap, Cpu, Sparkles, Loader2, Download } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TwinCanvas } from "@/components/twin-canvas";
import { CONTINGENCIES, buildTopology, solvePowerFlowCpu, type PowerFlowResult } from "@/lib/twin-topology";
import { solvePowerFlowGpu } from "@/lib/twin-gpu";
import { runTwinSimulation } from "@/lib/twin-bridge";
import type { TwinSimFrame } from "@/workers/twin.worker";
import {
  loadModel, generate, isWebGPUAvailable, DEFAULT_MODEL_ID, AVAILABLE_MODELS, type ModelStatus,
} from "@/lib/llm-bridge";

const SIM_STEPS = 20;

export default function DigitalTwinPage() {
  const [selectedContingencies, setSelectedContingencies] = useState<string[]>(["trip-northgate-subb"]);

  // Task 8: one-shot WebGPU vs CPU network-impact solve
  const [solveResult, setSolveResult] = useState<{ gpu: PowerFlowResult | null; cpu: PowerFlowResult; gpuMs: number; cpuMs: number; gpuSupported: boolean } | null>(null);
  const [solving, setSolving] = useState(false);

  // Task 11: Web Worker recovery timeline; task 10: Canvas consumes currentFrame
  const [currentFrame, setCurrentFrame] = useState<TwinSimFrame | null>(null);
  const [history, setHistory] = useState<{ t: string; loadShedMW: number }[]>([]);
  const [simRunning, setSimRunning] = useState(false);
  const [simDone, setSimDone] = useState(false);

  // Task 9: LLM-generated outcome narrative
  const webgpu = useRef(false);
  const [selectedModelId, setSelectedModelId] = useState(DEFAULT_MODEL_ID);
  const [loadedModelId, setLoadedModelId] = useState<string | null>(null);
  const [modelStatus, setModelStatus] = useState<ModelStatus>("idle");
  const [modelProgress, setModelProgress] = useState<{ file: string; pct: number } | null>(null);
  const [narrative, setNarrative] = useState("");
  const [narrativeBusy, setNarrativeBusy] = useState(false);

  useEffect(() => {
    webgpu.current = isWebGPUAvailable();
    if (!webgpu.current) setModelStatus("no-webgpu");
  }, []);

  function toggleContingency(id: string) {
    setSelectedContingencies((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setSolveResult(null);
    setSimDone(false);
    setNarrative("");
  }

  async function solveNetworkImpact() {
    setSolving(true);
    const topo = buildTopology(selectedContingencies, 0);
    const t0 = performance.now();
    const cpu = solvePowerFlowCpu(topo);
    const cpuMs = performance.now() - t0;

    const gpuSupported = typeof navigator !== "undefined" && !!navigator.gpu;
    let gpu: PowerFlowResult | null = null;
    let gpuMs = 0;
    if (gpuSupported) {
      try {
        const t1 = performance.now();
        gpu = await solvePowerFlowGpu(topo);
        gpuMs = performance.now() - t1;
      } catch (err) {
        console.error("[Digital Twin] GPU solve failed:", err);
      }
    }
    setSolveResult({ gpu, cpu, gpuMs, cpuMs, gpuSupported });
    setSolving(false);
  }

  async function runRecoverySimulation() {
    setSimRunning(true);
    setSimDone(false);
    setHistory([]);
    setNarrative("");
    try {
      await runTwinSimulation(selectedContingencies, SIM_STEPS, (frame) => {
        setCurrentFrame(frame);
        setHistory((prev) => [...prev, { t: `${Math.round(frame.recoveryFrac * 30)}m`, loadShedMW: Math.round(frame.result.loadShedMW) }]);
      });
      setSimDone(true);
    } catch (err) {
      console.error("[Digital Twin] simulation worker failed:", err);
    } finally {
      setSimRunning(false);
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
      console.error("[Digital Twin] local model failed to load:", err);
      setModelStatus(webgpu.current ? "error" : "no-webgpu");
      setModelProgress(null);
    }
  }

  async function generateOutcomeNarrative() {
    if (modelStatus !== "ready" || !currentFrame) return;
    setNarrativeBusy(true);
    setNarrative("");
    const labels = selectedContingencies.map((id) => CONTINGENCIES.find((c) => c.id === id)?.label ?? id).join("; ");
    const initial = history[0]?.loadShedMW ?? 0;
    const final = history[history.length - 1]?.loadShedMW ?? 0;
    const prompt =
      `Contingency simulated: ${labels || "none selected"}.\n` +
      `Load shed immediately after the event: ${initial} MW. Load shed after 30-minute recovery: ${final} MW.\n` +
      `Write a 2-3 sentence grid-operator outcome summary describing what happened and how the system recovered.`;
    try {
      await generate(
        [
          { role: "system", content: "You are a grid operations assistant summarizing a digital-twin contingency simulation. Be concise and operational." },
          { role: "user", content: prompt },
        ],
        (full) => setNarrative(full),
      );
    } catch (err) {
      setNarrative(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setNarrativeBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Grid Digital Twin</h1>
        <p className="text-sm text-muted-foreground mt-1">Trip any combination of assets and solve the real network-wide impact via a DC power-flow model.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-1.5"><Activity className="h-4 w-4" /> Select contingencies</CardTitle>
          <CardDescription>Any combination — not limited to 3 canned scenarios.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {CONTINGENCIES.map((c) => (
            <label key={c.id} className={`flex items-center gap-2 text-xs p-2.5 rounded-lg border cursor-pointer transition-all ${selectedContingencies.includes(c.id) ? "border-red-300 bg-red-50/50" : "hover:bg-muted/40"}`}>
              <input type="checkbox" checked={selectedContingencies.includes(c.id)} onChange={() => toggleContingency(c.id)} />
              {c.label}
            </label>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-1.5"><Zap className="h-4 w-4" /> Solve network impact — WebGPU vs CPU</CardTitle>
            <CardDescription>Real DC power-flow Jacobi solver, run both ways for comparison.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button size="sm" onClick={solveNetworkImpact} disabled={solving}><Play className="h-3.5 w-3.5" /> {solving ? "Solving…" : "Solve network impact"}</Button>
            {solveResult && (
              <div className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-muted/40 p-2"><p className="text-xs text-muted-foreground flex items-center gap-1"><Cpu className="h-3 w-3" /> CPU</p><p className="font-mono font-semibold">{solveResult.cpuMs.toFixed(2)} ms</p></div>
                  <div className="rounded-lg bg-muted/40 p-2"><p className="text-xs text-muted-foreground flex items-center gap-1"><Zap className="h-3 w-3" /> WebGPU {!solveResult.gpuSupported && "(unavailable)"}</p><p className="font-mono font-semibold">{solveResult.gpu ? `${solveResult.gpuMs.toFixed(2)} ms` : "—"}</p></div>
                </div>
                <p><span className="font-semibold text-red-600">{Math.round(solveResult.cpu.loadShedMW)} MW</span> load shed · {solveResult.cpu.reachable.filter((r) => !r).length} bus(es) de-energized</p>
                {solveResult.cpu.lineFlows.filter((f) => f.overloaded).length > 0 && (
                  <p className="text-amber-600">{solveResult.cpu.lineFlows.filter((f) => f.overloaded).length} line(s) overloaded post-contingency.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-1.5"><Activity className="h-4 w-4" /> Recovery simulation — Web Worker</CardTitle>
            <CardDescription>Steps the contingency toward recovery over 30 simulated minutes, off the main thread.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button size="sm" onClick={runRecoverySimulation} disabled={simRunning}><Play className="h-3.5 w-3.5" /> {simRunning ? "Simulating…" : "Run recovery simulation"}</Button>
            {history.length > 0 && (
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="t" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="loadShedMW" stroke="#dc2626" strokeWidth={2} dot={false} name="Load shed (MW)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Live network topology</CardTitle>
          <CardDescription>Animated via Canvas + requestAnimationFrame, synced to the simulation&apos;s current frame.</CardDescription>
        </CardHeader>
        <CardContent>
          <TwinCanvas frame={currentFrame} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-1.5"><Sparkles className="h-4 w-4" /> AI outcome narrative</CardTitle>
          <CardDescription>Generated by the local WebLLM model from this run&apos;s actual numbers, not scripted per-scenario text.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
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
            <Button size="sm" variant="outline" onClick={generateOutcomeNarrative} disabled={narrativeBusy || !simDone}>
              {narrativeBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {narrativeBusy ? "Generating…" : simDone ? "Generate outcome narrative" : "Run a simulation first"}
            </Button>
          )}
          {modelStatus === "no-webgpu" && <p className="text-xs text-muted-foreground">WebGPU unavailable in this browser.</p>}
          {narrative && <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/40 rounded-lg p-3">{narrative}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
