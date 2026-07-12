/// <reference lib="webworker" />
// PDF text-extraction worker. Runs pdf.js off the main thread so parsing a
// large document never blocks the UI. Chunks text into overlapping windows
// for downstream keyword search + compression.
// Adapted from https://github.com/vishalmysore/ragCompressionDemo (Apache-2.0).
import { getDocument, GlobalWorkerOptions, version as pdfjsVersion } from "pdfjs-dist";

GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsVersion}/pdf.worker.min.mjs`;

export interface RawPdfChunk {
  pageNumber: number;
  chunkIndex: number;
  content: string;
}

export type PdfWorkerRequest = { id: string; arrayBuffer: ArrayBuffer };
export type PdfWorkerResponse =
  | { id: string; ok: true; chunks: RawPdfChunk[]; numPages: number }
  | { id: string; ok: false; error: string };

const CHUNK_SIZE = 500;
const OVERLAP = 100;

function chunkText(text: string, pageNumber: number): RawPdfChunk[] {
  const chunks: RawPdfChunk[] = [];
  if (!text.trim()) return chunks;
  let i = 0;
  let chunkIndex = 0;
  while (i < text.length) {
    const slice = text.slice(i, i + CHUNK_SIZE);
    if (slice.trim().length > 20) {
      chunks.push({ pageNumber, chunkIndex, content: slice.trim() });
      chunkIndex++;
    }
    i += CHUNK_SIZE - OVERLAP;
  }
  return chunks;
}

self.onmessage = async (e: MessageEvent<PdfWorkerRequest>) => {
  const { id, arrayBuffer } = e.data;
  try {
    const pdf = await getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
    const allChunks: RawPdfChunk[] = [];

    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const textContent = await page.getTextContent();

      const text = textContent.items
        .map((item) => {
          const s = "str" in item ? item.str : "";
          const hasEOL = "hasEOL" in item ? item.hasEOL : false;
          return hasEOL ? s + "\n" : s + " ";
        })
        .join("")
        .replace(/\s{3,}/g, "  ")
        .trim();

      const pageChunks = chunkText(text, p);

      // Fallback: if page produced no chunks but had some text, use whole page as one chunk
      if (pageChunks.length === 0 && text.length > 20) {
        allChunks.push({ pageNumber: p, chunkIndex: 0, content: text });
      } else {
        allChunks.push(...pageChunks);
      }
    }

    const response: PdfWorkerResponse = { id, ok: true, chunks: allChunks, numPages: pdf.numPages };
    self.postMessage(response);
  } catch (err) {
    const response: PdfWorkerResponse = { id, ok: false, error: err instanceof Error ? err.message : String(err) };
    self.postMessage(response);
  }
};
