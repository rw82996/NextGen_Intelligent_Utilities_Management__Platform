// Same logistic-regression failure-risk model as public/models/failure-risk.onnx
// (sigmoid(W . [healthTerm, rulTerm, loadTerm] + b)), run three ways for comparison:
// CPU JS here, a WebGPU compute shader here, and ONNX Runtime Web (predictive-onnx.ts).
// Keep RISK_WEIGHTS/RISK_BIAS in sync with the weights baked into the ONNX model.

export const RISK_WEIGHTS = { health: 3.1, rul: 1.7, load: 0.9 } as const;
export const RISK_BIAS = -1.9;

export interface RiskFeatures {
  id: string;
  name: string;
  healthTerm: number;
  rulTerm: number;
  loadTerm: number;
}

export function cpuScoreRisk(f: RiskFeatures): number {
  const raw = f.healthTerm * RISK_WEIGHTS.health + f.rulTerm * RISK_WEIGHTS.rul + f.loadTerm * RISK_WEIGHTS.load + RISK_BIAS;
  return 1 / (1 + Math.exp(-raw));
}

const RISK_SHADER = `
struct Weights { health: f32, rul: f32, load: f32, bias: f32 }
struct Features { healthTerm: f32, rulTerm: f32, loadTerm: f32, _pad: f32 }
@group(0) @binding(0) var<storage, read> weights: Weights;
@group(0) @binding(1) var<storage, read> items: array<Features>;
@group(0) @binding(2) var<storage, read_write> results: array<f32>;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let idx = gid.x;
  if (idx >= arrayLength(&items)) { return; }
  let f = items[idx];
  let w = weights;
  let raw = f.healthTerm * w.health + f.rulTerm * w.rul + f.loadTerm * w.load + w.bias;
  results[idx] = 1.0 / (1.0 + exp(-raw));
}
`;

/** Batch-scores many risk-feature rows in parallel on the GPU via a WGSL compute shader. */
export async function gpuScoreRiskBatch(items: RiskFeatures[]): Promise<number[]> {
  if (!navigator.gpu) throw new Error("WebGPU not supported");
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error("No GPU adapter found");
  const device = await adapter.requestDevice();

  const weightData = new Float32Array([RISK_WEIGHTS.health, RISK_WEIGHTS.rul, RISK_WEIGHTS.load, RISK_BIAS]);
  const data = new Float32Array(items.length * 4);
  items.forEach((f, i) => {
    const o = i * 4;
    data[o] = f.healthTerm; data[o + 1] = f.rulTerm; data[o + 2] = f.loadTerm;
  });

  const weightBuffer = device.createBuffer({ size: weightData.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(weightBuffer, 0, weightData);
  const inBuffer = device.createBuffer({ size: data.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(inBuffer, 0, data);
  const resultBuffer = device.createBuffer({ size: items.length * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
  const readBuffer = device.createBuffer({ size: items.length * 4, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });

  const shaderModule = device.createShaderModule({ code: RISK_SHADER });
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
  pass.dispatchWorkgroups(Math.ceil(items.length / 64));
  pass.end();
  encoder.copyBufferToBuffer(resultBuffer, 0, readBuffer, 0, items.length * 4);
  device.queue.submit([encoder.finish()]);
  await readBuffer.mapAsync(GPUMapMode.READ);
  const output = new Float32Array(readBuffer.getMappedRange()).slice();
  readBuffer.unmap();
  device.destroy();
  return Array.from(output);
}

const GPU_OVERHEAD_MS = 3.0;
const GPU_PER_MS = 0.00018;
const CPU_PER_MS = 0.010;
export const RISK_CROSSOVER = Math.round(GPU_OVERHEAD_MS / (CPU_PER_MS - GPU_PER_MS));

export function simulateCpuBatchTime(count: number) { return count * CPU_PER_MS * (0.9 + Math.random() * 0.2); }
export function simulateGpuBatchTime(count: number) { return (GPU_OVERHEAD_MS + count * GPU_PER_MS) * (0.9 + Math.random() * 0.2); }
