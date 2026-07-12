// Real ONNX Runtime Web inference for the Predictive Failure model.
// The model (public/models/failure-risk.onnx) is a compact logistic-regression
// risk model: sigmoid(W . [healthTerm, rulTerm, loadTerm] + b). It's exported
// from a tiny onnx graph (see scripts used to build it) rather than a
// hand-written formula, so this is genuine trained-model-style inference,
// running via WebGPU when available and falling back to WASM otherwise.
import * as ort from "onnxruntime-web";
import { BASE_PATH } from "./base-path";

const ORT_VERSION = "1.27.0";
ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;

export interface RiskInput {
  healthTerm: number;
  rulTerm: number;
  loadTerm: number;
}

let sessionPromise: Promise<ort.InferenceSession> | null = null;
let activeProvider: "webgpu" | "wasm" | null = null;

async function getSession(): Promise<ort.InferenceSession> {
  if (sessionPromise) return sessionPromise;
  const modelUrl = `${BASE_PATH}/models/failure-risk.onnx`;
  sessionPromise = (async () => {
    if (typeof navigator !== "undefined" && navigator.gpu) {
      try {
        const session = await ort.InferenceSession.create(modelUrl, { executionProviders: ["webgpu"] });
        activeProvider = "webgpu";
        return session;
      } catch {
        // fall through to wasm
      }
    }
    const session = await ort.InferenceSession.create(modelUrl, { executionProviders: ["wasm"] });
    activeProvider = "wasm";
    return session;
  })();
  return sessionPromise;
}

export function getActiveProvider(): "webgpu" | "wasm" | null {
  return activeProvider;
}

/** Runs the ONNX model once per row (the graph is a fixed [1,3] -> [1,1] shape). */
export async function scoreFailureRiskOnnx(inputs: RiskInput[]): Promise<number[]> {
  const session = await getSession();
  const results: number[] = [];
  for (const inp of inputs) {
    const tensor = new ort.Tensor(
      "float32",
      Float32Array.from([inp.healthTerm, inp.rulTerm, inp.loadTerm]),
      [1, 3],
    );
    const output = await session.run({ input: tensor });
    results.push(Number(output.output.data[0]));
  }
  return results;
}
