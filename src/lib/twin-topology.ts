// A small but real DC power-flow network model for the Digital Twin.
// Solves B*theta = P via Jacobi iteration (parallelizes naturally on the GPU —
// see twin-gpu.ts for the WebGPU version; this file has the shared topology
// plus a CPU reference implementation used both standalone and inside the
// simulation Web Worker).

export const MAX_DEGREE = 4;

export interface Bus {
  id: string;
  name: string;
  kind: "slack" | "generation" | "load" | "hub" | "storage";
  basePowerMW: number; // + generation, - load, 0 for hubs
}

export interface Edge {
  from: string;
  to: string;
  susceptance: number; // higher = stiffer tie, more transfer capacity
}

export const BUSES: Bus[] = [
  { id: "NORTHGATE", name: "Northgate 345kV Substation", kind: "slack", basePowerMW: 0 },
  { id: "DOWNTOWN", name: "Downtown Load Center", kind: "load", basePowerMW: -1200 },
  { id: "SUBSTATION_B", name: "Substation B", kind: "hub", basePowerMW: 0 },
  { id: "WESTFIELD_SOLAR", name: "Westfield Solar Farm", kind: "generation", basePowerMW: 220 },
  { id: "INDUSTRIAL_CORRIDOR", name: "Industrial Corridor Load", kind: "load", basePowerMW: -900 },
  { id: "BATTERY_SITE", name: "Grid Battery Storage", kind: "storage", basePowerMW: 0 },
  { id: "SUBSTATION_C", name: "Substation C", kind: "hub", basePowerMW: 0 },
  { id: "HARBOR_GAS", name: "Harbor Gas Peaker", kind: "generation", basePowerMW: 400 },
  { id: "SUBURBAN", name: "Suburban Load Center", kind: "load", basePowerMW: -1100 },
  { id: "CEDAR_ZONE", name: "Cedar Load Zone", kind: "load", basePowerMW: -1450 },
];

export const EDGES: Edge[] = [
  { from: "NORTHGATE", to: "DOWNTOWN", susceptance: 8 },
  { from: "NORTHGATE", to: "SUBSTATION_B", susceptance: 6 },
  { from: "SUBSTATION_B", to: "WESTFIELD_SOLAR", susceptance: 5 },
  { from: "SUBSTATION_B", to: "INDUSTRIAL_CORRIDOR", susceptance: 6 },
  { from: "SUBSTATION_B", to: "BATTERY_SITE", susceptance: 4 },
  { from: "NORTHGATE", to: "SUBSTATION_C", susceptance: 6 },
  { from: "SUBSTATION_C", to: "HARBOR_GAS", susceptance: 5 },
  { from: "SUBSTATION_C", to: "SUBURBAN", susceptance: 6 },
  { from: "SUBSTATION_C", to: "CEDAR_ZONE", susceptance: 6 },
  { from: "DOWNTOWN", to: "INDUSTRIAL_CORRIDOR", susceptance: 3 }, // tie line
  { from: "SUBURBAN", to: "CEDAR_ZONE", susceptance: 3 },          // tie line
];

export interface Contingency {
  id: string;
  label: string;
  kind: "line" | "generation" | "hub";
  target: string; // edge "from|to" for lines, bus id otherwise
}

export const CONTINGENCIES: Contingency[] = [
  { id: "trip-northgate-downtown", label: "Trip Northgate ↔ Downtown line", kind: "line", target: "NORTHGATE|DOWNTOWN" },
  { id: "trip-northgate-subb", label: "Trip Northgate ↔ Substation B line", kind: "line", target: "NORTHGATE|SUBSTATION_B" },
  { id: "trip-northgate-subc", label: "Trip Northgate ↔ Substation C line", kind: "line", target: "NORTHGATE|SUBSTATION_C" },
  { id: "trip-solar", label: "Drop Westfield Solar output", kind: "generation", target: "WESTFIELD_SOLAR" },
  { id: "trip-gas", label: "Drop Harbor Gas Peaker output", kind: "generation", target: "HARBOR_GAS" },
  { id: "trip-subb", label: "Isolate Substation B (hub failure)", kind: "hub", target: "SUBSTATION_B" },
  { id: "trip-subc", label: "Isolate Substation C (hub failure)", kind: "hub", target: "SUBSTATION_C" },
  { id: "trip-battery", label: "Battery offline (no storage support)", kind: "generation", target: "BATTERY_SITE" },
];

/** Battery dispatch support available during a contingency, ramped in over recovery. */
export const BATTERY_MAX_MW = 150;

export interface EffectiveTopology {
  busIndex: Record<string, number>;
  power: Float32Array;       // per-bus net injection, includes battery dispatch
  neighbors: Int32Array;     // busCount * MAX_DEGREE, -1 = unused slot
  weights: Float32Array;     // busCount * MAX_DEGREE
}

/**
 * Builds the per-bus power + adjacency-list encoding for the solver, applying
 * a set of active contingencies and a 0..1 recovery fraction (battery/generation
 * ramping back in over the simulated timeline).
 */
export function buildTopology(activeContingencyIds: string[], recoveryFrac: number): EffectiveTopology {
  const active = new Set(activeContingencyIds);
  const busIndex: Record<string, number> = {};
  BUSES.forEach((b, i) => { busIndex[b.id] = i; });
  const n = BUSES.length;

  const trippedLines = new Set<string>();
  const droppedGenBuses = new Set<string>();
  const isolatedHubs = new Set<string>();

  for (const cid of active) {
    const c = CONTINGENCIES.find((x) => x.id === cid);
    if (!c) continue;
    if (c.kind === "line") trippedLines.add(c.target);
    else if (c.kind === "generation") droppedGenBuses.add(c.target);
    else if (c.kind === "hub") isolatedHubs.add(c.target);
  }

  const power = new Float32Array(n);
  BUSES.forEach((b, i) => {
    let p = b.basePowerMW;
    if (droppedGenBuses.has(b.id)) p *= 1 - recoveryFrac; // ramps back in as recovery proceeds
    if (b.id === "BATTERY_SITE" && (active.size > 0) && !droppedGenBuses.has("BATTERY_SITE")) {
      p += BATTERY_MAX_MW * Math.min(1, recoveryFrac + 0.3); // batteries respond fast, near-immediate partial support
    }
    power[i] = p;
  });

  const neighbors = new Int32Array(n * MAX_DEGREE).fill(-1);
  const weights = new Float32Array(n * MAX_DEGREE);
  const slot = new Array(n).fill(0);

  function addEdge(aId: string, bId: string, w: number) {
    const a = busIndex[aId], b = busIndex[bId];
    if (slot[a] < MAX_DEGREE) { neighbors[a * MAX_DEGREE + slot[a]] = b; weights[a * MAX_DEGREE + slot[a]] = w; slot[a]++; }
    if (slot[b] < MAX_DEGREE) { neighbors[b * MAX_DEGREE + slot[b]] = a; weights[b * MAX_DEGREE + slot[b]] = w; slot[b]++; }
  }

  for (const e of EDGES) {
    const key = `${e.from}|${e.to}`;
    if (trippedLines.has(key)) continue;
    if (isolatedHubs.has(e.from) || isolatedHubs.has(e.to)) continue;
    addEdge(e.from, e.to, e.susceptance);
  }

  return { busIndex, power, neighbors, weights };
}

/** BFS reachability from the slack bus — unreachable buses are de-energized (blacked out). */
export function reachableFromSlack(topo: EffectiveTopology): boolean[] {
  const n = topo.power.length;
  const slackIdx = topo.busIndex["NORTHGATE"];
  const reachable = new Array(n).fill(false);
  const queue = [slackIdx];
  reachable[slackIdx] = true;
  while (queue.length) {
    const i = queue.shift()!;
    for (let k = 0; k < MAX_DEGREE; k++) {
      const j = topo.neighbors[i * MAX_DEGREE + k];
      if (j >= 0 && !reachable[j]) { reachable[j] = true; queue.push(j); }
    }
  }
  return reachable;
}

export interface LineFlow {
  from: string;
  to: string;
  flowMW: number;
  overloaded: boolean;
  connected: boolean;
}

export interface PowerFlowResult {
  theta: number[];
  reachable: boolean[];
  loadShedMW: number;
  lineFlows: LineFlow[];
  iterations: number;
}

/** Reference CPU Jacobi solver — also used as the WebGPU version's fallback/parity check. */
export function solvePowerFlowCpu(topo: EffectiveTopology, iterations = 60): PowerFlowResult {
  const n = topo.power.length;
  const reachable = reachableFromSlack(topo);
  const slackIdx = topo.busIndex["NORTHGATE"];
  let theta = new Float32Array(n);
  let next = new Float32Array(n);

  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < n; i++) {
      if (i === slackIdx || !reachable[i]) { next[i] = 0; continue; }
      let sumBTheta = 0, sumB = 0;
      for (let k = 0; k < MAX_DEGREE; k++) {
        const j = topo.neighbors[i * MAX_DEGREE + k];
        if (j < 0) continue;
        const w = topo.weights[i * MAX_DEGREE + k];
        sumBTheta += w * theta[j];
        sumB += w;
      }
      next[i] = sumB > 1e-4 ? (topo.power[i] + sumBTheta) / sumB : 0;
    }
    [theta, next] = [next, theta];
  }

  let loadShedMW = 0;
  BUSES.forEach((b, i) => {
    if (!reachable[i] && b.basePowerMW < 0) loadShedMW += -b.basePowerMW;
  });

  const lineFlows = EDGES.map((e) => {
    const a = topo.busIndex[e.from], b = topo.busIndex[e.to];
    const stillConnected = topo.neighbors.slice(a * MAX_DEGREE, a * MAX_DEGREE + MAX_DEGREE).includes(b);
    if (!stillConnected) return { from: e.from, to: e.to, flowMW: 0, overloaded: false, connected: false };
    const flow = e.susceptance * (theta[a] - theta[b]) * 50; // scale to MW-ish units for display
    return { from: e.from, to: e.to, flowMW: flow, overloaded: Math.abs(flow) > 900, connected: true };
  });

  return { theta: Array.from(theta), reachable, loadShedMW, lineFlows, iterations };
}
