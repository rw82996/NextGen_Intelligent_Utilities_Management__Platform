// Main-thread bridge to the Digital Twin simulation worker. Streams one
// frame per recovery-timeline step so the UI can animate as they arrive.
import type { TwinSimRequest, TwinWorkerResponse, TwinSimFrame } from "@/workers/twin.worker";

let worker: Worker | null = null;

function ensureWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("../workers/twin.worker.ts", import.meta.url), { type: "module" });
  return worker;
}

export function runTwinSimulation(
  activeContingencyIds: string[],
  steps: number,
  onFrame: (frame: TwinSimFrame) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const w = ensureWorker();
    w.onmessage = (e: MessageEvent<TwinWorkerResponse>) => {
      if (e.data.type === "frame") onFrame(e.data.frame);
      else if (e.data.type === "done") resolve();
    };
    w.onerror = (e) => reject(new Error(e.message));
    const req: TwinSimRequest = { activeContingencyIds, steps };
    w.postMessage(req);
  });
}
