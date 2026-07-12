// WebGPU version of the DC power-flow Jacobi solver in twin-topology.ts.
// Encodes all iterations into a single command buffer, ping-ponging two
// storage buffers between passes so the whole 60-iteration solve is one
// GPU submission instead of 60 round-trips.
import { MAX_DEGREE, BUSES, EDGES, BASE_MVA, LINE_OVERLOAD_MW, reachableFromSlack, type EffectiveTopology, type PowerFlowResult } from "./twin-topology";

const JACOBI_SHADER = `
struct Bus { power: f32, isSlack: f32, reachable: f32, _pad: f32 }
@group(0) @binding(0) var<storage, read> buses: array<Bus>;
@group(0) @binding(1) var<storage, read> neighbors: array<i32>;
@group(0) @binding(2) var<storage, read> weights: array<f32>;
@group(0) @binding(3) var<storage, read> thetaIn: array<f32>;
@group(0) @binding(4) var<storage, read_write> thetaOut: array<f32>;
const MAX_DEGREE: u32 = ${MAX_DEGREE}u;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= arrayLength(&buses)) { return; }
  let bus = buses[i];
  if (bus.isSlack > 0.5 || bus.reachable < 0.5) { thetaOut[i] = 0.0; return; }
  var sumBTheta = 0.0;
  var sumB = 0.0;
  for (var k = 0u; k < MAX_DEGREE; k = k + 1u) {
    let j = neighbors[i * MAX_DEGREE + k];
    if (j >= 0) {
      let w = weights[i * MAX_DEGREE + k];
      sumBTheta = sumBTheta + w * thetaIn[u32(j)];
      sumB = sumB + w;
    }
  }
  thetaOut[i] = select(0.0, (bus.power + sumBTheta) / sumB, sumB > 0.0001);
}
`;

export async function solvePowerFlowGpu(topo: EffectiveTopology, iterations = 60): Promise<PowerFlowResult> {
  if (!navigator.gpu) throw new Error("WebGPU not supported");
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error("No GPU adapter found");
  const device = await adapter.requestDevice();

  const n = BUSES.length;
  const reachable = reachableFromSlack(topo);
  const slackIdx = topo.busIndex["NORTHGATE"];

  const busData = new Float32Array(n * 4);
  BUSES.forEach((_, i) => {
    busData[i * 4] = topo.power[i];
    busData[i * 4 + 1] = i === slackIdx ? 1 : 0;
    busData[i * 4 + 2] = reachable[i] ? 1 : 0;
  });

  const busBuf = device.createBuffer({ size: busData.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(busBuf, 0, busData);
  const neighborBuf = device.createBuffer({ size: topo.neighbors.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(neighborBuf, 0, new Int32Array(topo.neighbors));
  const weightBuf = device.createBuffer({ size: topo.weights.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(weightBuf, 0, new Float32Array(topo.weights));

  const zero = new Float32Array(n);
  const thetaA = device.createBuffer({ size: zero.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC });
  const thetaB = device.createBuffer({ size: zero.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC });
  device.queue.writeBuffer(thetaA, 0, zero);
  device.queue.writeBuffer(thetaB, 0, zero);
  const readBuf = device.createBuffer({ size: zero.byteLength, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });

  const shaderModule = device.createShaderModule({ code: JACOBI_SHADER });
  const pipeline = device.createComputePipeline({ layout: "auto", compute: { module: shaderModule, entryPoint: "main" } });
  const layout = pipeline.getBindGroupLayout(0);

  const bindAB = device.createBindGroup({ layout, entries: [
    { binding: 0, resource: { buffer: busBuf } }, { binding: 1, resource: { buffer: neighborBuf } },
    { binding: 2, resource: { buffer: weightBuf } }, { binding: 3, resource: { buffer: thetaA } }, { binding: 4, resource: { buffer: thetaB } },
  ] });
  const bindBA = device.createBindGroup({ layout, entries: [
    { binding: 0, resource: { buffer: busBuf } }, { binding: 1, resource: { buffer: neighborBuf } },
    { binding: 2, resource: { buffer: weightBuf } }, { binding: 3, resource: { buffer: thetaB } }, { binding: 4, resource: { buffer: thetaA } },
  ] });

  const encoder = device.createCommandEncoder();
  for (let it = 0; it < iterations; it++) {
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, it % 2 === 0 ? bindAB : bindBA);
    pass.dispatchWorkgroups(Math.ceil(n / 64));
    pass.end();
  }
  const finalBuf = iterations % 2 === 0 ? thetaA : thetaB;
  encoder.copyBufferToBuffer(finalBuf, 0, readBuf, 0, zero.byteLength);
  device.queue.submit([encoder.finish()]);
  await readBuf.mapAsync(GPUMapMode.READ);
  const theta = new Float32Array(readBuf.getMappedRange()).slice();
  readBuf.unmap();
  device.destroy();

  let loadShedMW = 0;
  BUSES.forEach((b, i) => { if (!reachable[i] && b.basePowerMW < 0) loadShedMW += -b.basePowerMW; });

  const lineFlows = EDGES.map((e) => {
    const a = topo.busIndex[e.from], b = topo.busIndex[e.to];
    const stillConnected = topo.neighbors.slice(a * MAX_DEGREE, a * MAX_DEGREE + MAX_DEGREE).includes(b);
    if (!stillConnected) return { from: e.from, to: e.to, flowMW: 0, overloaded: false, connected: false };
    const flow = e.susceptance * (theta[a] - theta[b]) * BASE_MVA;
    return { from: e.from, to: e.to, flowMW: flow, overloaded: Math.abs(flow) > LINE_OVERLOAD_MW, connected: true };
  });

  return { theta: Array.from(theta), reachable, loadShedMW, lineFlows, iterations };
}
