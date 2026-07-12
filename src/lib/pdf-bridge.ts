// Main-thread bridge to the PDF-parsing worker. Mirrors the llm-bridge.ts
// pattern: a single worker instance, promise-based request/response.
import type { PdfWorkerRequest, PdfWorkerResponse, RawPdfChunk } from "@/workers/pdf.worker";

let worker: Worker | null = null;
const pending = new Map<string, { resolve: (v: { chunks: RawPdfChunk[]; numPages: number }) => void; reject: (e: Error) => void }>();
let msgId = 0;

function ensureWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("../workers/pdf.worker.ts", import.meta.url), {
    type: "module",
  });
  worker.onmessage = (e: MessageEvent<PdfWorkerResponse>) => {
    const msg = e.data;
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    if (msg.ok) p.resolve({ chunks: msg.chunks, numPages: msg.numPages });
    else p.reject(new Error(msg.error));
  };
  return worker;
}

export function extractPdf(arrayBuffer: ArrayBuffer): Promise<{ chunks: RawPdfChunk[]; numPages: number }> {
  const id = String(msgId++);
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    const req: PdfWorkerRequest = { id, arrayBuffer };
    ensureWorker().postMessage(req, [arrayBuffer]);
  });
}
