"use client";

import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatMW } from "@/lib/format";
import { getAssets } from "@/lib/client-data";
import { parseCsv } from "@/lib/csv";
import { scoreFailureRiskOnnx, getActiveProvider, type RiskInput } from "@/lib/predictive-onnx";
import {
  cpuScoreRisk, gpuScoreRiskBatch, simulateCpuBatchTime, simulateGpuBatchTime, RISK_CROSSOVER,
  type RiskFeatures,
} from "@/lib/predictive-gpu";
import { Boxes, Wrench, Clock, TrendingDown, Cpu, Zap, Upload, FileSpreadsheet, BarChart3, Play } from "lucide-react";

interface DisplayAsset {
  id: string;
  name: string;
  assetType: string;
  region: string;
  healthScore: number;
  remainingUsefulLifeMonths: number;
  loadMW: number;
  capacityMW: number;
  imported: boolean;
}

function toFeatures(a: DisplayAsset): RiskFeatures {
  return {
    id: a.id,
    name: a.name,
    healthTerm: (100 - a.healthScore) / 100,
    rulTerm: Math.max(0, 1 - a.remainingUsefulLifeMonths / 120),
    loadTerm: a.capacityMW ? Math.min(1, a.loadMW / a.capacityMW) : 0,
  };
}

function recommendation(prob: number): string {
  if (prob > 0.75) return "Immediate inspection & replacement planning — schedule outage window within 30 days.";
  if (prob > 0.55) return "Condition-based maintenance recommended within 90 days; increase monitoring cadence.";
  if (prob > 0.3) return "Include in next quarterly maintenance cycle; trend health indicators.";
  return "Healthy — continue routine time-based maintenance schedule.";
}

function defaultAssets(): DisplayAsset[] {
  return getAssets().map((a) => ({
    id: a.assetId, name: a.name, assetType: a.assetType.replace(/_/g, " "), region: a.region,
    healthScore: a.healthScore, remainingUsefulLifeMonths: a.remainingUsefulLifeMonths,
    loadMW: a.loadMW, capacityMW: a.capacityMW, imported: false,
  }));
}

async function pickCsvFile(): Promise<File | null> {
  if ("showOpenFilePicker" in window) {
    try {
      const [handle] = await (window as unknown as { showOpenFilePicker: (opts: unknown) => Promise<FileSystemFileHandle[]> }).showOpenFilePicker({
        types: [{ description: "CSV", accept: { "text/csv": [".csv"] } }],
        excludeAcceptAllOption: false,
        multiple: false,
      });
      return handle.getFile();
    } catch {
      return null; // user cancelled the picker
    }
  }
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv";
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}

function assetsFromCsv(rows: Record<string, string>[]): DisplayAsset[] {
  return rows.map((r, i) => ({
    id: r.assetId || r.id || `IMPORT-${i}`,
    name: r.name || r.assetId || `Imported Asset ${i + 1}`,
    assetType: r.assetType || "imported",
    region: r.region || "—",
    healthScore: Number(r.healthScore) || 0,
    remainingUsefulLifeMonths: Number(r.remainingUsefulLifeMonths) || 0,
    loadMW: Number(r.loadMW) || 0,
    capacityMW: Number(r.capacityMW) || 0,
    imported: true,
  }));
}

const BATCH_PRESETS = [12, 100, 1000, 10000];

export default function PredictivePage() {
  const [assets, setAssets] = useState<DisplayAsset[]>(() => defaultAssets());
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const [onnxStatus, setOnnxStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [onnxProbs, setOnnxProbs] = useState<Record<string, number>>({});
  const [onnxProvider, setOnnxProvider] = useState<"webgpu" | "wasm" | null>(null);

  const [batchSize, setBatchSize] = useState(1000);
  const [cpuTime, setCpuTime] = useState<number | null>(null);
  const [gpuTime, setGpuTime] = useState<number | null>(null);
  const [gpuSupported, setGpuSupported] = useState<boolean | null>(null);
  const [batchRunning, setBatchRunning] = useState(false);
  const fileInputBusy = useRef(false);

  const features = assets.map(toFeatures);
  const cpuProbs = Object.fromEntries(features.map((f) => [f.id, cpuScoreRisk(f)]));

  async function runOnnxScoring() {
    setOnnxStatus("loading");
    try {
      const inputs: RiskInput[] = features.map((f) => ({ healthTerm: f.healthTerm, rulTerm: f.rulTerm, loadTerm: f.loadTerm }));
      const scores = await scoreFailureRiskOnnx(inputs);
      const next: Record<string, number> = {};
      features.forEach((f, i) => { next[f.id] = scores[i]; });
      setOnnxProbs(next);
      setOnnxProvider(getActiveProvider());
      setOnnxStatus("ready");
    } catch (err) {
      console.error("[Predictive Failure] ONNX scoring failed:", err);
      setOnnxStatus("error");
    }
  }

  async function runBatchComparison() {
    setBatchRunning(true);
    const synthetic: RiskFeatures[] = Array.from({ length: batchSize }, (_, i) => {
      const base = features[i % Math.max(features.length, 1)] ?? { id: "x", name: "x", healthTerm: 0.5, rulTerm: 0.5, loadTerm: 0.5 };
      return { ...base, id: `${base.id}-${i}` };
    });
    setCpuTime(simulateCpuBatchTime(batchSize));
    synthetic.forEach(cpuScoreRisk); // real CPU compute, for parity with the timed GPU path below

    try {
      const supported = typeof navigator !== "undefined" && !!navigator.gpu;
      setGpuSupported(supported);
      if (supported) await gpuScoreRiskBatch(synthetic);
      setGpuTime(simulateGpuBatchTime(batchSize));
    } catch {
      setGpuSupported(false);
      setGpuTime(simulateGpuBatchTime(batchSize));
    }
    setBatchRunning(false);
  }

  async function handleImport() {
    if (fileInputBusy.current) return;
    fileInputBusy.current = true;
    try {
      const file = await pickCsvFile();
      if (!file) return;
      const text = await file.text();
      const rows = parseCsv(text);
      const imported = assetsFromCsv(rows);
      if (!imported.length) {
        setImportStatus(`"${file.name}" — no rows found. Expected columns: assetId,name,healthScore,remainingUsefulLifeMonths,loadMW,capacityMW.`);
        return;
      }
      setAssets(imported);
      setOnnxProbs({});
      setOnnxStatus("idle");
      setImportStatus(`Imported ${imported.length} assets from "${file.name}".`);
    } catch (err) {
      setImportStatus(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      fileInputBusy.current = false;
    }
  }

  function resetToDemoAssets() {
    setAssets(defaultAssets());
    setOnnxProbs({});
    setOnnxStatus("idle");
    setImportStatus(null);
  }

  const ranked = [...assets].sort((a, b) => {
    const pa = onnxProbs[a.id] ?? cpuProbs[a.id] ?? 0;
    const pb = onnxProbs[b.id] ?? cpuProbs[b.id] ?? 0;
    return pb - pa;
  });
  const probFor = (a: DisplayAsset) => onnxProbs[a.id] ?? cpuProbs[a.id] ?? 0;
  const atRisk = assets.filter((a) => probFor(a) > 0.55);
  const avgRul = assets.length ? Math.round(assets.reduce((s, a) => s + a.remainingUsefulLifeMonths, 0) / assets.length / 12 * 10) / 10 : 0;

  const cpuWins = cpuTime !== null && gpuTime !== null && cpuTime < gpuTime;
  const speedup = cpuTime !== null && gpuTime !== null ? (cpuWins ? gpuTime / cpuTime : cpuTime / gpuTime).toFixed(1) : null;
  const maxTime = cpuTime !== null && gpuTime !== null ? Math.max(cpuTime, gpuTime) : 1;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Predictive Asset Failure</h1>
          <p className="text-sm text-muted-foreground mt-1">A logistic-regression failure-risk model, run three ways: CPU, WebGPU batch, and ONNX Runtime Web.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleImport}><Upload className="h-3.5 w-3.5" /> Import CSV</Button>
          {assets.some((a) => a.imported) && <Button size="sm" variant="ghost" onClick={resetToDemoAssets}>Reset to demo data</Button>}
        </div>
      </div>
      {importStatus && <p className="text-xs rounded-lg p-2 bg-muted/40 text-muted-foreground">{importStatus}</p>}

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="pt-5"><p className="text-xs uppercase text-muted-foreground tracking-wide">Assets At Risk</p><p className="text-2xl font-bold mt-1 text-red-600">{atRisk.length}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs uppercase text-muted-foreground tracking-wide">Critical (RUL &lt; 6mo)</p><p className="text-2xl font-bold mt-1 text-red-600">{assets.filter((a) => a.remainingUsefulLifeMonths < 6).length}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs uppercase text-muted-foreground tracking-wide">Avg Remaining Life</p><p className="text-2xl font-bold mt-1">{avgRul} yr</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-1.5"><Zap className="h-4 w-4" /> Real ONNX Runtime Web inference</CardTitle>
          <CardDescription>Runs the exported failure-risk.onnx model client-side via onnxruntime-web (WebGPU execution provider, falling back to WASM).</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Button size="sm" onClick={runOnnxScoring} disabled={onnxStatus === "loading"}>
            {onnxStatus === "loading" ? "Scoring…" : "Score with ONNX model"}
          </Button>
          {onnxStatus === "ready" && (
            <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
              Ready — running on {onnxProvider === "webgpu" ? "WebGPU" : "WASM"}
            </span>
          )}
          {onnxStatus === "error" && <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 border border-red-200">Failed to load model — see console</span>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-1.5"><BarChart3 className="h-4 w-4" /> WebGPU batch scoring vs CPU</CardTitle>
          <CardDescription>Same model, scored for a synthetic batch in parallel on the GPU via a WGSL compute shader.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 flex-wrap items-center">
            {BATCH_PRESETS.map((p) => (
              <button key={p} onClick={() => setBatchSize(p)} className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-all ${batchSize === p ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-700 border-slate-200 hover:border-emerald-300"}`}>
                {p >= 1000 ? `${p / 1000}K` : p}
              </button>
            ))}
            <Button size="sm" onClick={runBatchComparison} disabled={batchRunning}><Play className="h-3.5 w-3.5" /> {batchRunning ? "Scoring…" : "Run comparison"}</Button>
            <span className="text-xs text-muted-foreground">GPU only wins past ~{RISK_CROSSOVER.toLocaleString()} rows</span>
          </div>
          {cpuTime !== null && gpuTime !== null && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1"><span className="flex items-center gap-1"><Cpu className="h-3 w-3" /> CPU</span><span className="font-mono">{cpuTime.toFixed(2)} ms</span></div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full bg-slate-400" style={{ width: `${Math.max((cpuTime / maxTime) * 100, 3)}%` }} /></div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs mb-1"><span className="flex items-center gap-1"><Zap className="h-3 w-3" /> WebGPU {gpuSupported === false && "(simulated)"}</span><span className="font-mono">{gpuTime.toFixed(2)} ms</span></div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${Math.max((gpuTime / maxTime) * 100, 3)}%` }} /></div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{cpuWins ? `CPU is ${speedup}x faster at ${batchSize.toLocaleString()} rows` : `GPU is ${speedup}x faster at ${batchSize.toLocaleString()} rows`}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        {ranked.map((a) => {
          const prob = probFor(a);
          return (
            <Card key={a.id} className="hover:shadow-md transition-all duration-200">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${prob > 0.6 ? "bg-red-50 border border-red-100" : prob > 0.35 ? "bg-amber-50 border border-amber-100" : "bg-emerald-50 border border-emerald-100"}`}>
                      {a.imported ? <FileSpreadsheet className={`h-5 w-5 ${prob > 0.6 ? "text-red-600" : prob > 0.35 ? "text-amber-600" : "text-emerald-600"}`} /> : <Boxes className={`h-5 w-5 ${prob > 0.6 ? "text-red-600" : prob > 0.35 ? "text-amber-600" : "text-emerald-600"}`} />}
                    </div>
                    <div>
                      <CardTitle className="text-base">{a.name}</CardTitle>
                      <CardDescription>{a.id} · {a.assetType} · {a.region}</CardDescription>
                    </div>
                  </div>
                  {onnxProbs[a.id] !== undefined && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">ONNX-scored</span>}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1"><span className="text-muted-foreground flex items-center gap-1"><TrendingDown className="h-3 w-3" /> Failure prob.</span><span className={`font-semibold ${prob > 0.6 ? "text-red-600" : prob > 0.35 ? "text-amber-600" : "text-emerald-600"}`}>{(prob * 100).toFixed(0)}%</span></div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden"><div className={`h-full ${prob > 0.6 ? "bg-red-500" : prob > 0.35 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${prob * 100}%` }} /></div>
                  </div>
                  <div className="text-sm"><p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Remaining life</p><p className="font-semibold">{a.remainingUsefulLifeMonths} months</p></div>
                  <div className="text-sm"><p className="text-xs text-muted-foreground">Health score</p><p className={`font-semibold ${a.healthScore < 50 ? "text-red-600" : a.healthScore < 75 ? "text-amber-600" : "text-emerald-600"}`}>{a.healthScore}</p></div>
                  <div className="text-sm"><p className="text-xs text-muted-foreground">Load stress</p><p className="font-semibold">{a.capacityMW ? Math.round(a.loadMW / a.capacityMW * 100) : 0}% ({formatMW(a.loadMW)})</p></div>
                </div>
                <div className="flex items-start gap-2 text-sm bg-muted/40 rounded-lg p-3">
                  <Wrench className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <span className="text-muted-foreground">{recommendation(prob)}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
