/// <reference lib="webworker" />
// WebLLM inference worker. Runs the local model off the main thread so model
// download, WebGPU compilation and token generation never block the UI.
import {
  CreateMLCEngine,
  type MLCEngineInterface,
  type InitProgressReport,
  type ChatCompletionMessageParam,
} from "@mlc-ai/web-llm";

export type WorkerRequest =
  | { action: "load"; modelId: string; gen: number }
  | { action: "generate"; messages: ChatCompletionMessageParam[]; gen: number }
  | { action: "cancel" }
  | { action: "dispose" };

export type WorkerResponse =
  | { status: "downloading"; file: string; progress: number }
  | { status: "ready"; modelId: string }
  | { status: "token"; delta: string; full: string }
  | { status: "success"; full: string }
  | { status: "error"; error: string }
  | { status: "cancelled" }
  | { status: "disposed" };

let engine: MLCEngineInterface | null = null;
let currentModelId: string | null = null;

const post = (msg: WorkerResponse) => self.postMessage(msg);

async function disposeCurrent() {
  if (engine) {
    try {
      await engine.unload();
    } catch {
      /* ignore unload errors */
    }
    engine = null;
    currentModelId = null;
  }
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const data = e.data;

  try {
    if (data.action === "load") {
      await disposeCurrent();

      const nav = self.navigator as Navigator & { gpu?: GPU };
      if (!nav.gpu) {
        post({
          status: "error",
          error: "WebGPU not supported. Use Chrome/Edge 113+ on a machine with a compatible GPU.",
        });
        return;
      }
      const adapter = await nav.gpu.requestAdapter();
      if (!adapter) {
        post({ status: "error", error: "No WebGPU adapter available." });
        return;
      }

      engine = await CreateMLCEngine(data.modelId, {
        initProgressCallback: (report: InitProgressReport) => {
          post({
            status: "downloading",
            file: report.text ?? "",
            progress: Math.round((report.progress ?? 0) * 100),
          });
        },
      });
      currentModelId = data.modelId;
      post({ status: "ready", modelId: currentModelId });
    } else if (data.action === "generate") {
      if (!engine) {
        post({ status: "error", error: "Model not loaded." });
        return;
      }
      const stream = await engine.chat.completions.create({
        messages: data.messages,
        stream: true,
        max_tokens: 512,
        temperature: 0.2,
      });
      let full = "";
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content ?? "";
        if (delta) {
          full += delta;
          post({ status: "token", delta, full });
        }
      }
      post({ status: "success", full });
    } else if (data.action === "cancel") {
      if (engine) {
        try {
          await engine.interruptGenerate();
        } catch {
          /* ignore */
        }
      }
      post({ status: "cancelled" });
    } else if (data.action === "dispose") {
      await disposeCurrent();
      post({ status: "disposed" });
    }
  } catch (err) {
    post({ status: "error", error: err instanceof Error ? err.message : String(err) });
  }
};
