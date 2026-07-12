"use client";

import { useState, useRef, useEffect } from "react";
import { Bot, Send, Sparkles, ArrowRight, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { CopilotMessage } from "@/types";
import { copilotSuggestions } from "@/lib/theft";

export default function CopilotPage() {
  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      id: "welcome", role: "assistant", timestamp: new Date().toISOString(),
      content: "Hello! I'm your **Grid Copilot**. I can help with grid load & reserves, outage risk, asset failure prediction, energy-theft alerts, and demand forecasting. What would you like to know?",
      suggestedActions: [],
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(msg?: string) {
    const text = msg ?? input;
    if (!text.trim() || loading) return;
    const userMsg: CopilotMessage = { id: crypto.randomUUID(), role: "user", content: text, timestamp: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/copilot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text }) });
      const data = (await res.json()) as CopilotMessage;
      setMessages((prev) => [...prev, data]);
    } catch {
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: "Sorry, something went wrong. Please try again.", timestamp: new Date().toISOString() }]);
    } finally {
      setLoading(false);
    }
  }

  function renderContent(content: string) {
    return content.split("\n").map((line, i) => {
      const boldReplaced = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      if (!line.trim()) return <br key={i} />;
      if (line.startsWith("- ")) return <li key={i} className="ml-4 list-disc" dangerouslySetInnerHTML={{ __html: boldReplaced.slice(2) }} />;
      return <p key={i} dangerouslySetInnerHTML={{ __html: boldReplaced }} />;
    });
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="border-b bg-gradient-to-r from-emerald-600 to-cyan-600 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">Grid Copilot</h1>
            <p className="text-xs text-white/70">AI operator assistant for grid ops, outages &amp; forecasting</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1">
            <span className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse" />
            <span className="text-xs text-white/80">Online</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
            {msg.role === "assistant" && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-600">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
            )}
            <div className={`max-w-[600px] ${msg.role === "user" ? "bg-gradient-to-r from-emerald-600 to-cyan-600 text-white rounded-2xl rounded-br-md px-4 py-3" : ""}`}>
              {msg.role === "assistant" && (
                <Card className="shadow-sm border-0 bg-slate-50">
                  <CardContent className="p-4 text-sm leading-relaxed space-y-2">
                    {renderContent(msg.content)}
                    {msg.data && msg.data.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {msg.data.map((item, i) => (
                          <div key={i} className={`flex items-center justify-between rounded-lg border p-3 bg-white ${item.type === "alert" ? "border-l-4 border-l-amber-400" : item.type === "asset" ? "border-l-4 border-l-emerald-400" : ""}`}>
                            <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
                            <span className="text-xs font-semibold">{item.value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {msg.suggestedActions.map((action, i) => (
                          <Button key={i} size="sm" variant={action.variant === "outline" ? "outline" : "default"} className={action.variant !== "outline" ? "bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700 text-xs" : "text-xs"} onClick={() => window.location.href = action.action}>
                            {action.label} <ArrowRight className="h-3 w-3 ml-1" />
                          </Button>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
              {msg.role === "user" && <p className="text-sm">{msg.content}</p>}
            </div>
            {msg.role === "user" && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-200">
                <User className="h-4 w-4 text-slate-600" />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-600">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <Card className="shadow-sm border-0 bg-slate-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="flex gap-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </span>
                  Analyzing grid state...
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {messages.length === 1 && (
        <div className="px-6 pb-3">
          <p className="text-xs text-muted-foreground mb-2 font-medium">Suggested prompts</p>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
            {copilotSuggestions.map((s) => (
              <button key={s} onClick={() => handleSend(s)} className="text-left text-xs p-3 rounded-lg border hover:bg-emerald-50/50 hover:border-emerald-300 transition-colors">
                <Sparkles className="h-3 w-3 text-emerald-500 mb-1" />
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="border-t bg-white p-4">
        <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2 max-w-3xl mx-auto">
          <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about grid load, outages, asset risk, theft..." className="flex-1 h-11 bg-slate-50 border-slate-200" disabled={loading} />
          <Button type="submit" disabled={loading || !input.trim()} className="h-11 px-5 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700 shadow-md shadow-emerald-500/20">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
