"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { FileText, Upload, Search, Download, Loader2, Cpu } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { chunkStore } from "@/lib/chunk-store";
import { extractPdf } from "@/lib/pdf-bridge";
import { preloadTokenizer, countTokens } from "@/lib/tokenizer";
import { compressContentSync, compressContent, METHODS, type CompressionMethod } from "@/lib/headroom-engine";
import {
  loadModel,
  generate,
  isWebGPUAvailable,
  DEFAULT_MODEL_ID,
  type ModelStatus,
} from "@/lib/llm-bridge";

const DEFAULT_COLUMNS: [CompressionMethod, CompressionMethod, CompressionMethod] = ["none", "headroom-smart", "headroom-aggressive"];

type PdfStatus = { msg: string; type: "idle" | "ok" | "err" | "info" };

const CATEGORY_STYLE: Record<string, string> = {
  baseline: "text-slate-500",
  smart: "text-emerald-600",
  classic: "text-amber-600",
  advanced: "text-purple-600",
};

export default function DocumentsPage() {
  const [pdfStatus, setPdfStatus] = useState<PdfStatus>({ msg: "", type: "idle" });
  const [totalChunks, setTotalChunks] = useState(0);

  const [modelStatus, setModelStatus] = useState<ModelStatus>("idle");
  const [modelProgress, setModelProgress] = useState<{ file: string; pct: number } | null>(null);
  const webgpu = useRef(false);

  const [question, setQuestion] = useState("");
  const [rawContext, setRawContext] = useState("");
  const [searching, setSearching] = useState(false);

  const [colMethods, setColMethods] = useState<[CompressionMethod, CompressionMethod, CompressionMethod]>(DEFAULT_COLUMNS);
  const [colContexts, setColContexts] = useState<[string, string, string]>(["", "", ""]);
  const [colAnswers, setColAnswers] = useState<[string, string, string]>(["", "", ""]);
  const [colGenerating, setColGenerating] = useState<[boolean, boolean, boolean]>([false, false, false]);
  const anyGenerating = colGenerating.some(Boolean);

  useEffect(() => {
    preloadTokenizer();
    webgpu.current = isWebGPUAvailable();
    if (!webgpu.current) setModelStatus("no-webgpu");
  }, []);

  async function handleLoadModel() {
    setModelStatus("loading");
    try {
      await loadModel(DEFAULT_MODEL_ID, (p) => setModelProgress({ file: p.file, pct: p.progress }));
      setModelStatus("ready");
      setModelProgress(null);
    } catch (err) {
      console.error("[Document Intelligence] local model failed to load:", err);
      setModelStatus(webgpu.current ? "error" : "no-webgpu");
      setModelProgress(null);
    }
  }

  const onPdfFile = useCallback(async (file: File) => {
    setPdfStatus({ msg: `Reading ${file.name}…`, type: "info" });
    setTotalChunks(0);
    setRawContext("");
    setColContexts(["", "", ""]);
    setColAnswers(["", "", ""]);
    try {
      const buf = await file.arrayBuffer();
      const { chunks, numPages } = await extractPdf(buf);
      if (!chunks.length) {
        setPdfStatus({ msg: `No text found in "${file.name}" — may be a scanned PDF.`, type: "err" });
        return;
      }
      chunkStore.reset();
      chunkStore.insert(chunks.map((c, i) => ({
        chunkId: `p${c.pageNumber}_c${i}`,
        pageNumber: c.pageNumber,
        chunkIndex: c.chunkIndex,
        content: c.content,
        tokenCount: countTokens(c.content),
      })));
      setTotalChunks(chunkStore.count());
      setPdfStatus({ msg: `"${file.name}" — ${chunkStore.count()} chunks · ${numPages} pages`, type: "ok" });
    } catch (err) {
      setPdfStatus({ msg: `Error: ${err instanceof Error ? err.message : String(err)}`, type: "err" });
    }
  }, []);

  const buildContexts = useCallback(async (raw: string, q: string, methods: typeof colMethods): Promise<[string, string, string]> => {
    const results = await Promise.all(methods.map(method => {
      const cfg = {
        compressionRatioTarget: method === "headroom-aggressive" ? 0.15 : 0.45,
        useEntropyPreservation: true,
        tokenBudget: 4000,
      };
      const sync = compressContentSync(raw, cfg, q, method);
      if (sync) return Promise.resolve(sync.compressed);
      return compressContent(raw, cfg, q, method).then(r => r.compressed);
    }));
    return results as [string, string, string];
  }, []);

  const searchRag = useCallback(async () => {
    if (!question.trim() || totalChunks === 0) return;
    setSearching(true);
    setColAnswers(["", "", ""]);
    setRawContext("");
    try {
      const results = chunkStore.search(question, 5);
      if (!results.length) return;
      const raw = results.map(r => `[Page ${r.pageNumber}]\n${r.content}`).join("\n\n");
      setRawContext(raw);
      setColContexts(await buildContexts(raw, question, colMethods));
    } finally {
      setSearching(false);
    }
  }, [question, totalChunks, colMethods, buildContexts]);

  // Rebuild when a column's method changes
  useEffect(() => {
    if (!rawContext) return;
    buildContexts(rawContext, question, colMethods).then(setColContexts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colMethods]);

  const askLlm = useCallback(async (col: 0 | 1 | 2) => {
    if (modelStatus !== "ready" || !colContexts[col] || !question.trim() || anyGenerating) return;
    setColGenerating(g => { const n = [...g] as typeof g; n[col] = true; return n; });
    setColAnswers(a => { const n = [...a] as typeof a; n[col] = ""; return n; });
    try {
      const msgs = [
        { role: "system" as const, content: "Answer based only on the provided context. Be concise." },
        { role: "user" as const, content: `Context:\n${colContexts[col]}\n\nQuestion: ${question}` },
      ];
      await generate(msgs, (full) => {
        setColAnswers(a => { const n = [...a] as typeof a; n[col] = full; return n; });
      });
    } catch (err) {
      setColAnswers(a => { const n = [...a] as typeof a; n[col] = `Error: ${err instanceof Error ? err.message : String(err)}`; return n; });
    } finally {
      setColGenerating(g => { const n = [...g] as typeof g; n[col] = false; return n; });
    }
  }, [modelStatus, colContexts, question, anyGenerating]);

  const rawTokens = countTokens(rawContext);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Document Intelligence</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload a grid manual, compliance report, or incident PDF — compare how context compression affects
          the local Grid Copilot model&apos;s answer quality and token cost, side by side.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-1.5"><FileText className="h-4 w-4" /> 1. Upload PDF</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <label
              className="flex flex-col items-center justify-center h-20 border-2 border-dashed rounded-lg cursor-pointer text-xs text-muted-foreground hover:border-emerald-400 hover:text-emerald-600 transition-colors"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type === "application/pdf") onPdfFile(f); }}
            >
              <Upload className="h-4 w-4 mb-1" />
              <span>Drop PDF or browse</span>
              <input type="file" accept=".pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onPdfFile(f); e.target.value = ""; }} />
            </label>
            {pdfStatus.msg && (
              <p className={`text-xs rounded-lg p-2 leading-relaxed ${pdfStatus.type === "ok" ? "text-emerald-700 bg-emerald-50 border border-emerald-200" : pdfStatus.type === "err" ? "text-red-700 bg-red-50 border border-red-200" : "text-muted-foreground bg-muted/40"}`}>
                {pdfStatus.msg}
              </p>
            )}

            <div className="pt-2 border-t space-y-2">
              <p className="text-sm font-semibold flex items-center gap-1.5"><Cpu className="h-4 w-4" /> 2. Local model</p>
              {modelStatus === "ready" ? (
                <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2">Model ready</p>
              ) : modelStatus === "no-webgpu" ? (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">WebGPU unavailable in this browser</p>
              ) : (
                <Button size="sm" variant="outline" onClick={handleLoadModel} disabled={modelStatus === "loading"} className="w-full">
                  {modelStatus === "loading" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  {modelStatus === "loading" ? (modelProgress ? `Loading ${modelProgress.pct}%` : "Loading…") : modelStatus === "error" ? "Retry load" : "Load model"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-1.5"><Search className="h-4 w-4" /> 3. Ask a question — keyword search over PDF chunks</CardTitle>
            <CardDescription>Retrieves the top matching chunks, then compresses them differently per column below.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchRag()}
                placeholder={totalChunks > 0 ? "e.g. What are the main findings?" : "Upload a PDF first…"}
                disabled={totalChunks === 0}
                className="flex-1"
              />
              <Button onClick={searchRag} disabled={searching || !question.trim() || totalChunks === 0}>
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {searching ? "Searching…" : "Search"}
              </Button>
            </div>
            {rawContext && (
              <p className="text-xs text-muted-foreground">
                Raw retrieved context: <span className="font-semibold text-foreground">{rawTokens.toLocaleString()} tok</span>
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {([0, 1, 2] as const).map((col) => {
          const method = colMethods[col];
          const info = METHODS.find((m) => m.key === method)!;
          const tok = countTokens(colContexts[col] || "");
          const pct = rawTokens > 0 ? Math.round((1 - tok / rawTokens) * 100) : 0;
          const canAsk = modelStatus === "ready" && !!colContexts[col] && !!question.trim() && !anyGenerating;

          return (
            <Card key={col}>
              <CardHeader className="space-y-2">
                <select
                  value={method}
                  onChange={(e) => setColMethods((prev) => { const n = [...prev] as typeof prev; n[col] = e.target.value as CompressionMethod; return n; })}
                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                >
                  {(["baseline", "smart", "classic", "advanced"] as const).map((cat) => (
                    <optgroup key={cat} label={cat.toUpperCase()}>
                      {METHODS.filter((m) => m.category === cat).map((m) => (
                        <option key={m.key} value={m.key}>{m.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${CATEGORY_STYLE[info.category]}`}>{info.desc}</span>
                  {tok > 0 && (
                    <span className="text-xs font-semibold shrink-0 ml-2">
                      {tok.toLocaleString()} tok {pct > 0 && <span className="text-emerald-600">-{pct}%</span>}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg bg-muted/40 p-2.5 h-32 overflow-y-auto">
                  {colContexts[col] ? (
                    <pre className="text-[11px] text-muted-foreground leading-relaxed whitespace-pre-wrap font-sans">{colContexts[col]}</pre>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center mt-8">{totalChunks > 0 ? "Search to see context" : "Upload a PDF first"}</p>
                  )}
                </div>
                <Button size="sm" variant="outline" onClick={() => askLlm(col)} disabled={!canAsk || colGenerating[col]} className="w-full">
                  {colGenerating[col] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  {colGenerating[col] ? "Generating…" : canAsk ? `Ask (${tok.toLocaleString()} tok)` : modelStatus !== "ready" ? "Load model first" : "Search first"}
                </Button>
                <div className="rounded-lg border p-2.5 min-h-24">
                  {colAnswers[col] ? (
                    <p className="text-xs leading-relaxed whitespace-pre-wrap">{colAnswers[col]}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center mt-6">{modelStatus === "ready" ? "Click Ask" : "Load model first"}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
