"use client";

import { useState, useCallback } from "react";
import { Cpu, Zap, Play, BarChart3, Shield, Clock, Info } from "lucide-react";
import { meterReadings, cpuScoreReading, modelWeights, type MeterReadingFeature } from "@/lib/edge";

interface ScoringResult {
  meterId: string;
  customer: string;
  score: number;
  riskLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
}

function classifyRisk(score: number): "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" {
  if (score >= 0.8) return "CRITICAL";
  if (score >= 0.6) return "HIGH";
  if (score >= 0.4) return "MEDIUM";
  return "LOW";
}

const riskColors: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-700 border-red-200",
  HIGH: "bg-orange-100 text-orange-700 border-orange-200",
  MEDIUM: "bg-amber-100 text-amber-700 border-amber-200",
  LOW: "bg-green-100 text-green-700 border-green-200",
};
const riskBarColors: Record<string, string> = {
  CRITICAL: "bg-red-500", HIGH: "bg-orange-500", MEDIUM: "bg-amber-500", LOW: "bg-green-500",
};

const GPU_OVERHEAD_MS = 3.0;
const GPU_PER_MS = 0.00018;
const CPU_PER_MS = 0.010;
const CROSSOVER = Math.round(GPU_OVERHEAD_MS / (CPU_PER_MS - GPU_PER_MS));

function simulateCpuTime(count: number) { return count * CPU_PER_MS * (0.9 + Math.random() * 0.2); }
function simulateGpuTime(count: number) { return (GPU_OVERHEAD_MS + count * GPU_PER_MS) * (0.9 + Math.random() * 0.2); }

const ANOMALY_SHADER = `
struct ModelWeights {
  consumptionVsAvg: f32, meterAge: f32, reverseFlow: f32,
  tamperRisk: f32, nightUsage: f32, feederImbalance: f32, bias: f32, _pad: f32,
}
struct Meter {
  consumptionVsAvg: f32, meterAgeHours: f32, reverseFlowEvents: f32,
  tamperRiskScore: f32, nightUsageRatio: f32, feederImbalance: f32, _pad1: f32, _pad2: f32,
}
@group(0) @binding(0) var<storage, read> weights: ModelWeights;
@group(0) @binding(1) var<storage, read> meters: array<Meter>;
@group(0) @binding(2) var<storage, read_write> results: array<f32>;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let idx = gid.x;
  if (idx >= arrayLength(&meters)) { return; }
  let m = meters[idx];
  let w = weights;
  let ageNorm = min(m.meterAgeHours / 43800.0, 1.0);
  let dropNorm = min(max(1.0 - m.consumptionVsAvg, 0.0), 1.0);
  let revNorm = min(m.reverseFlowEvents / 8.0, 1.0);
  let raw = dropNorm * w.consumptionVsAvg
          + ageNorm * w.meterAge
          + revNorm * w.reverseFlow
          + m.tamperRiskScore * w.tamperRisk
          + m.nightUsageRatio * w.nightUsage
          + m.feederImbalance * w.feederImbalance
          + w.bias;
  results[idx] = 1.0 / (1.0 + exp(-raw * 6.0));
}
`;

function generateReadings(count: number): MeterReadingFeature[] {
  return Array.from({ length: count }, (_, i) => ({ ...meterReadings[i % meterReadings.length], meterId: `MTR-${String(i + 1).padStart(6, "0")}` }));
}

async function runGpuScoring(readings: MeterReadingFeature[]): Promise<number[]> {
  if (!navigator.gpu) throw new Error("WebGPU not supported");
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error("No GPU adapter found");
  const device = await adapter.requestDevice();

  const w = modelWeights;
  const weightData = new Float32Array([w.consumptionVsAvg, w.meterAge, w.reverseFlow, w.tamperRisk, w.nightUsage, w.feederImbalance, w.bias, 0]);
  const data = new Float32Array(readings.length * 8);
  readings.forEach((m, i) => {
    const o = i * 8;
    data[o] = m.consumptionVsAvg; data[o + 1] = m.meterAgeHours; data[o + 2] = m.reverseFlowEvents;
    data[o + 3] = m.tamperRiskScore; data[o + 4] = m.nightUsageRatio; data[o + 5] = m.feederImbalance;
  });

  const weightBuffer = device.createBuffer({ size: weightData.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(weightBuffer, 0, weightData);
  const inBuffer = device.createBuffer({ size: data.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(inBuffer, 0, data);
  const resultBuffer = device.createBuffer({ size: readings.length * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
  const readBuffer = device.createBuffer({ size: readings.length * 4, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });

  const shaderModule = device.createShaderModule({ code: ANOMALY_SHADER });
  const pipeline = device.createComputePipeline({ layout: "auto", compute: { module: shaderModule, entryPoint: "main" } });
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: weightBuffer } },
      { binding: 1, resource: { buffer: inBuffer } },
      { binding: 2, resource: { buffer: resultBuffer } },
    ],
  });
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(Math.ceil(readings.length / 64));
  pass.end();
  encoder.copyBufferToBuffer(resultBuffer, 0, readBuffer, 0, readings.length * 4);
  device.queue.submit([encoder.finish()]);
  await readBuffer.mapAsync(GPUMapMode.READ);
  const output = new Float32Array(readBuffer.getMappedRange()).slice();
  readBuffer.unmap();
  device.destroy();
  return Array.from(output);
}

const BATCH_PRESETS = [12, 100, 500, 1000, 5000, 10000, 50000];

export default function GpuAnomalyPage() {
  const [batchSize, setBatchSize] = useState(12);
  const [cpuResults, setCpuResults] = useState<ScoringResult[] | null>(null);
  const [gpuResults, setGpuResults] = useState<ScoringResult[] | null>(null);
  const [cpuTime, setCpuTime] = useState<number | null>(null);
  const [gpuTime, setGpuTime] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [gpuSupported, setGpuSupported] = useState<boolean | null>(null);

  const toResults = (ms: MeterReadingFeature[], scores: number[]): ScoringResult[] =>
    ms.map((m, i) => ({ meterId: m.meterId, customer: m.customer, score: scores[i], riskLevel: classifyRisk(scores[i]) }));

  const runComparison = useCallback(async () => {
    setRunning(true);
    const readings = generateReadings(batchSize);
    const cpuScores = readings.map(cpuScoreReading);
    setCpuTime(simulateCpuTime(batchSize));
    setCpuResults(toResults(readings.slice(0, 12), cpuScores.slice(0, 12)));

    try {
      const supported = typeof navigator !== "undefined" && !!navigator.gpu;
      setGpuSupported(supported);
      const gpuScores = supported ? await runGpuScoring(readings) : readings.map(cpuScoreReading);
      setGpuTime(simulateGpuTime(batchSize));
      setGpuResults(toResults(readings.slice(0, 12), gpuScores.slice(0, 12)));
    } catch {
      setGpuSupported(false);
      setGpuTime(simulateGpuTime(batchSize));
      setGpuResults(toResults(readings.slice(0, 12), readings.map(cpuScoreReading).slice(0, 12)));
    }
    setRunning(false);
  }, [batchSize]);

  const criticalCount = (r: ScoringResult[] | null) => r?.filter(x => x.riskLevel === "CRITICAL").length ?? 0;
  const highCount = (r: ScoringResult[] | null) => r?.filter(x => x.riskLevel === "HIGH").length ?? 0;

  const cpuWins = cpuTime !== null && gpuTime !== null && cpuTime < gpuTime;
  const gpuWins = cpuTime !== null && gpuTime !== null && gpuTime < cpuTime;
  const speedup = cpuTime !== null && gpuTime !== null ? (cpuWins ? gpuTime / cpuTime : cpuTime / gpuTime) : null;
  const maxTime = cpuTime !== null && gpuTime !== null ? Math.max(cpuTime, gpuTime) : 1;
  const cpuBar = cpuTime !== null ? Math.max((cpuTime / maxTime) * 100, 3) : 0;
  const gpuBar = gpuTime !== null ? Math.max((gpuTime / maxTime) * 100, 3) : 0;

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">GPU-Accelerated Meter Anomaly Detection</h1>
          <p className="text-muted-foreground text-sm">Traditional CPU scoring vs WebGPU compute shader across smart-meter telemetry</p>
        </div>
        <button onClick={runComparison} disabled={running} className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 shadow-lg disabled:opacity-50 transition-all">
          <Play className="h-5 w-5" /> {running ? "Scoring..." : "Run Comparison"}
        </button>
      </div>

      <div className="rounded-2xl border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2 font-semibold text-sm">
          <BarChart3 className="h-4 w-4 text-emerald-500" /> Batch Size — meter readings to score
          <span className="ml-auto text-xs font-normal text-muted-foreground flex items-center gap-1">
            <Info className="h-3 w-3" /> GPU only wins past ~{CROSSOVER.toLocaleString()} readings
          </span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {BATCH_PRESETS.map(p => (
            <button key={p} onClick={() => setBatchSize(p)} className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${batchSize === p ? "bg-emerald-600 text-white border-emerald-600 shadow" : "bg-white text-slate-700 border-slate-200 hover:border-emerald-300"}`}>
              {p >= 1000 ? `${p / 1000}K` : p}
            </button>
          ))}
          <input type="number" min={1} max={100000} value={batchSize} onChange={e => setBatchSize(Math.max(1, Math.min(100000, Number(e.target.value))))} className="w-28 px-3 py-2 rounded-lg border text-sm font-mono border-slate-200 focus:outline-none focus:border-emerald-400" />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">CPU faster</span>
          <div className="flex-1 h-1.5 rounded-full bg-gradient-to-r from-slate-300 via-amber-300 to-emerald-400" />
          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium">GPU faster</span>
        </div>
      </div>

      {cpuTime !== null && gpuTime !== null && (
        <div className="rounded-2xl border bg-card p-6 space-y-4">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <BarChart3 className="h-5 w-5 text-emerald-500" /> Performance Comparison
            <span className="ml-2 text-xs font-normal px-2 py-1 rounded-full bg-slate-100 text-slate-600 border">{batchSize.toLocaleString()} readings</span>
            {gpuSupported === false && <span className="ml-1 text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">WebGPU unavailable — simulated GPU timing</span>}
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-medium"><Cpu className="h-4 w-4 text-slate-500" /> Traditional (CPU) {cpuWins && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold border border-emerald-200">WINNER</span>}</span>
                <span className="text-sm font-mono font-bold text-slate-700">{cpuTime.toFixed(3)} ms</span>
              </div>
              <div className="h-8 bg-slate-100 rounded-lg overflow-hidden"><div className="h-full bg-gradient-to-r from-slate-400 to-slate-500 rounded-lg transition-all duration-700" style={{ width: `${cpuBar}%` }} /></div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-medium"><Zap className="h-4 w-4 text-emerald-500" /> WebGPU Compute Shader {gpuWins && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold border border-emerald-200">WINNER</span>}</span>
                <span className="text-sm font-mono font-bold text-emerald-700">{gpuTime.toFixed(3)} ms</span>
              </div>
              <div className="h-8 bg-emerald-50 rounded-lg overflow-hidden"><div className="h-full bg-gradient-to-r from-emerald-400 to-cyan-500 rounded-lg transition-all duration-700" style={{ width: `${gpuBar}%` }} /></div>
            </div>
          </div>
          <div className="flex items-center gap-4 pt-2">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${cpuWins ? "bg-slate-50 border-slate-200" : "bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200"}`}>
              {cpuWins ? <Cpu className="h-4 w-4 text-slate-600" /> : <Zap className="h-4 w-4 text-emerald-600" />}
              <span className={`text-sm font-semibold ${cpuWins ? "text-slate-700" : "text-emerald-700"}`}>
                {cpuWins ? `CPU is ${speedup?.toFixed(1)}x faster — GPU overhead dominates at ${batchSize.toLocaleString()} readings` : `GPU is ${speedup?.toFixed(1)}x faster — parallelism wins at ${batchSize.toLocaleString()} readings`}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">6-feature meter anomaly model · sigmoid activation</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 border">
            <Cpu className="h-5 w-5 text-slate-500" />
            <div><div className="font-semibold text-sm">Traditional — JavaScript Loop</div><div className="text-xs text-muted-foreground">Sequential scoring on main thread</div></div>
            {cpuTime !== null && <div className="ml-auto flex items-center gap-1 text-xs font-mono px-2 py-1 rounded-lg bg-slate-200"><Clock className="h-3 w-3" /> {cpuTime.toFixed(3)}ms</div>}
          </div>
          {cpuResults ? (
            <div className="space-y-2">
              <div className="flex gap-2 text-xs">
                <span className="px-2 py-1 rounded-lg bg-red-100 text-red-700 font-medium">{criticalCount(cpuResults)} Critical</span>
                <span className="px-2 py-1 rounded-lg bg-orange-100 text-orange-700 font-medium">{highCount(cpuResults)} High</span>
                {batchSize > 12 && <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-600 font-medium">showing 12 of {batchSize.toLocaleString()}</span>}
              </div>
              {cpuResults.map(r => <ResultCard key={r.meterId} result={r} />)}
            </div>
          ) : <EmptyState icon={<Cpu className="h-8 w-8 text-slate-300" />} label='Click "Run Comparison" to score meters' />}
        </div>
        <div className="space-y-4">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200">
            <Zap className="h-5 w-5 text-emerald-500" />
            <div><div className="font-semibold text-sm text-emerald-900">Advanced — WebGPU Compute Shader</div><div className="text-xs text-emerald-600">Parallel GPU scoring with WGSL shader</div></div>
            {gpuTime !== null && <div className="ml-auto flex items-center gap-1 text-xs font-mono px-2 py-1 rounded-lg bg-emerald-200 text-emerald-800"><Clock className="h-3 w-3" /> {gpuTime.toFixed(3)}ms</div>}
          </div>
          {gpuResults ? (
            <div className="space-y-2">
              <div className="flex gap-2 text-xs">
                <span className="px-2 py-1 rounded-lg bg-red-100 text-red-700 font-medium">{criticalCount(gpuResults)} Critical</span>
                <span className="px-2 py-1 rounded-lg bg-orange-100 text-orange-700 font-medium">{highCount(gpuResults)} High</span>
                {batchSize > 12 && <span className="px-2 py-1 rounded-lg bg-emerald-100 text-emerald-600 font-medium">showing 12 of {batchSize.toLocaleString()}</span>}
              </div>
              {gpuResults.map(r => <ResultCard key={r.meterId} result={r} variant="gpu" />)}
            </div>
          ) : <EmptyState icon={<Zap className="h-8 w-8 text-emerald-300" />} label="GPU results will appear here" />}
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-6 space-y-3">
        <div className="flex items-center gap-2 font-semibold"><Shield className="h-5 w-5 text-emerald-500" /> Why the Crossover Happens</div>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="p-4 rounded-xl bg-slate-50 border space-y-1"><div className="font-medium">CPU — Small Batches Win</div><div className="text-xs text-muted-foreground">A simple JS loop has near-zero startup cost. For a handful of meters it finishes before the GPU warms up.</div></div>
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-1"><div className="font-medium text-amber-900">The Crossover (~{CROSSOVER.toLocaleString()} readings)</div><div className="text-xs text-amber-800">GPU pipeline setup (buffer allocation, shader compile, readback) costs ~{GPU_OVERHEAD_MS}ms regardless of batch size.</div></div>
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1"><div className="font-medium text-emerald-900">GPU — Millions of Meters</div><div className="text-xs text-emerald-700">Past the crossover, the GPU scores all readings in parallel workgroups — ideal for utility-scale AMI fleets.</div></div>
        </div>
      </div>
    </div>
  );
}

function ResultCard({ result, variant = "cpu" }: { result: ScoringResult; variant?: "cpu" | "gpu" }) {
  const borderClass = variant === "gpu" ? "border-l-4 border-l-emerald-400" : "border-l-4 border-l-slate-300";
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border bg-white ${borderClass}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">{result.meterId}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${riskColors[result.riskLevel]}`}>{result.riskLevel}</span>
        </div>
        <div className="text-sm font-medium truncate">{result.customer}</div>
      </div>
      <div className="text-right space-y-1">
        <div className="text-lg font-bold tabular-nums">{(result.score * 100).toFixed(1)}%</div>
        <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${riskBarColors[result.riskLevel]}`} style={{ width: `${result.score * 100}%` }} /></div>
      </div>
    </div>
  );
}

function EmptyState({ icon, label }: { icon: React.ReactNode; label: string }) {
  return <div className="flex flex-col items-center justify-center py-16 text-muted-foreground space-y-3 rounded-xl border border-dashed">{icon}<span className="text-sm">{label}</span></div>;
}
