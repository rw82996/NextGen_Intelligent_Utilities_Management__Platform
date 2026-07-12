// Shared result types for the compression engine.
// Adapted from https://github.com/vishalmysore/ragCompressionDemo (Apache-2.0).

export interface SimResult {
  compressed: string;
  tokensBefore: number;
  tokensAfter: number;
  compressionRatio: number;
  tokensSaved: number;
  pipeline: string;
  diffs: DiffChunk[];
}

export interface DiffChunk {
  type: "keep" | "remove" | "replace";
  original: string;
  replacement?: string;
}

export interface SimConfig {
  compressionRatioTarget: number;
  useEntropyPreservation: boolean;
  tokenBudget: number;
}
