// Main-thread bridge to the WebLLM worker. Keeps a single worker instance and
// exposes a small promise/callback API to load a model and stream completions.
import type { ChatCompletionMessageParam } from "@mlc-ai/web-llm";
import type { WorkerRequest, WorkerResponse } from "@/workers/llm.worker";

export type ModelStatus = "idle" | "loading" | "ready" | "no-webgpu" | "error";

// Small, browser-friendly instruct model. ~600MB download, WebGPU only.
export const DEFAULT_MODEL_ID = "Qwen2.5-0.5B-Instruct-q4f16_1-MLC";

export interface LoadProgress {
  file: string;
  progress: number;
}

let worker: Worker | null = null;
let status: ModelStatus = "idle";
let modelId: string | null = null;

let onProgress: ((p: LoadProgress) => void) | null = null;
let loadResolve: (() => void) | null = null;
let loadReject: ((err: Error) => void) | null = null;

let onToken: ((full: string) => void) | null = null;
let genResolve: ((full: string) => void) | null = null;
let genReject: ((err: Error) => void) | null = null;

export function isWebGPUAvailable(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

export function getStatus(): ModelStatus {
  return status;
}

export function getModelId(): string | null {
  return modelId;
}

function ensureWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("../workers/llm.worker.ts", import.meta.url), {
    type: "module",
  });
  worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
    const msg = e.data;
    switch (msg.status) {
      case "downloading":
        onProgress?.({ file: msg.file, progress: msg.progress });
        break;
      case "ready":
        status = "ready";
        modelId = msg.modelId;
        loadResolve?.();
        loadResolve = loadReject = null;
        break;
      case "token":
        onToken?.(msg.full);
        break;
      case "success":
        genResolve?.(msg.full);
        genResolve = genReject = onToken = null;
        break;
      case "error": {
        const err = new Error(msg.error);
        if (loadReject) {
          status = "error";
          loadReject(err);
          loadResolve = loadReject = null;
        } else if (genReject) {
          genReject(err);
          genResolve = genReject = onToken = null;
        }
        break;
      }
      case "cancelled":
      case "disposed":
        break;
    }
  };
  return worker;
}

function send(req: WorkerRequest) {
  ensureWorker().postMessage(req);
}

export function loadModel(
  id: string = DEFAULT_MODEL_ID,
  progress?: (p: LoadProgress) => void,
): Promise<void> {
  if (!isWebGPUAvailable()) {
    status = "no-webgpu";
    return Promise.reject(new Error("WebGPU not available in this browser."));
  }
  status = "loading";
  onProgress = progress ?? null;
  return new Promise<void>((resolve, reject) => {
    loadResolve = resolve;
    loadReject = reject;
    send({ action: "load", modelId: id, gen: 0 });
  });
}

export function generate(
  messages: ChatCompletionMessageParam[],
  token?: (full: string) => void,
): Promise<string> {
  if (status !== "ready") {
    return Promise.reject(new Error("Model not ready."));
  }
  onToken = token ?? null;
  return new Promise<string>((resolve, reject) => {
    genResolve = resolve;
    genReject = reject;
    send({ action: "generate", messages, gen: 0 });
  });
}

export function cancel() {
  if (worker) send({ action: "cancel" });
}

export function dispose() {
  if (worker) {
    send({ action: "dispose" });
    worker.terminate();
    worker = null;
    status = "idle";
    modelId = null;
  }
}
