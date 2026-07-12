/// <reference lib="webworker" />
// Runs the Digital Twin's contingency-recovery timeline off the main thread.
// Each step re-solves the DC power-flow network (CPU Jacobi solver — pure
// math, no DOM/GPU dependency, so it's safe inside a dedicated Worker) as
// tripped generation/lines ramp back toward normal, and streams one frame
// back per step so the UI can animate smoothly without blocking on the
// whole timeline up front.
import { buildTopology, solvePowerFlowCpu, type PowerFlowResult } from "@/lib/twin-topology";

export interface TwinSimRequest {
  activeContingencyIds: string[];
  steps: number;
}

export interface TwinSimFrame {
  step: number;
  steps: number;
  recoveryFrac: number;
  result: PowerFlowResult;
}

export type TwinWorkerResponse =
  | { type: "frame"; frame: TwinSimFrame }
  | { type: "done" };

self.onmessage = (e: MessageEvent<TwinSimRequest>) => {
  const { activeContingencyIds, steps } = e.data;
  for (let step = 0; step <= steps; step++) {
    const recoveryFrac = step / steps;
    const topo = buildTopology(activeContingencyIds, recoveryFrac);
    const result = solvePowerFlowCpu(topo);
    const frame: TwinSimFrame = { step, steps, recoveryFrac, result };
    const response: TwinWorkerResponse = { type: "frame", frame };
    self.postMessage(response);
  }
  const done: TwinWorkerResponse = { type: "done" };
  self.postMessage(done);
};
