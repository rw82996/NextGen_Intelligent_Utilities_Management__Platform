// Shared WebGPU compute pipeline for the meter anomaly/theft-risk model.
// Used by both the GPU Anomaly Scoring edge page and Energy-Theft Detection,
// so theft alerts are scored by the same real WGSL compute shader instead of
// duplicating it per page.
import { modelWeights, type MeterReadingFeature } from "./edge";

export const ANOMALY_SHADER = `
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

export async function runGpuScoring(readings: MeterReadingFeature[]): Promise<number[]> {
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
