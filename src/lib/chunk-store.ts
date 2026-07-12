// chunk-store.ts — lightweight in-memory keyword search over PDF chunks.
// Adapted from https://github.com/vishalmysore/ragCompressionDemo (Apache-2.0).
// A plain JS array is enough for a handful of PDF chunks and leaves WebGPU
// memory headroom for the LLM (no DuckDB/vector-DB dependency needed).

export interface PdfChunk {
  chunkId: string;
  pageNumber: number;
  chunkIndex: number;
  content: string;
  tokenCount: number;
}

let _chunks: PdfChunk[] = [];

export const chunkStore = {
  /** Replace all stored chunks (call before inserting a new PDF). */
  reset() {
    _chunks = [];
  },

  /** Bulk-insert chunks. */
  insert(chunks: PdfChunk[]) {
    _chunks.push(...chunks);
  },

  count() {
    return _chunks.length;
  },

  /**
   * Keyword search — scores each chunk by how many query terms appear in it,
   * then returns the top-K by score.
   */
  search(query: string, topK = 5): PdfChunk[] {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];

    return _chunks
      .map(c => ({
        chunk: c,
        score: terms.filter(t => c.content.toLowerCase().includes(t)).length,
      }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(x => x.chunk);
  },
};
