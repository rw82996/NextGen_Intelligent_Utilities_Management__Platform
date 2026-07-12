"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RiskBadge, StatusBadge } from "@/components/status-badge";
import { formatMW } from "@/lib/format";
import { Boxes, Wrench, Clock, TrendingDown } from "lucide-react";
import type { GridAsset } from "@/types";

function recommendation(a: GridAsset): string {
  if (a.riskLevel === "CRITICAL") return "Immediate inspection & replacement planning — schedule outage window within 30 days.";
  if (a.riskLevel === "HIGH") return "Condition-based maintenance recommended within 90 days; increase monitoring cadence.";
  if (a.riskLevel === "MEDIUM") return "Include in next quarterly maintenance cycle; trend health indicators.";
  return "Healthy — continue routine time-based maintenance schedule.";
}

// Composite failure-probability model from health, RUL and load stress
function failureProbability(a: GridAsset): number {
  const healthTerm = (100 - a.healthScore) / 100;
  const rulTerm = Math.max(0, 1 - a.remainingUsefulLifeMonths / 120);
  const loadTerm = a.capacityMW ? Math.min(1, a.loadMW / a.capacityMW) : 0;
  return Math.min(0.99, 0.55 * healthTerm + 0.3 * rulTerm + 0.15 * loadTerm);
}

export default function PredictivePage() {
  const [assets, setAssets] = useState<GridAsset[]>([]);

  useEffect(() => { fetch("/api/assets").then(r => r.json()).then(setAssets); }, []);

  const ranked = [...assets].sort((a, b) => failureProbability(b) - failureProbability(a));
  const atRisk = ranked.filter(a => a.riskLevel === "HIGH" || a.riskLevel === "CRITICAL");
  const avgRul = assets.length ? Math.round(assets.reduce((s, a) => s + a.remainingUsefulLifeMonths, 0) / assets.length / 12 * 10) / 10 : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Predictive Asset Failure</h1>
        <p className="text-sm text-muted-foreground mt-1">ML-ranked failure probability, remaining useful life &amp; maintenance planning.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="pt-5"><p className="text-xs uppercase text-muted-foreground tracking-wide">Assets At Risk</p><p className="text-2xl font-bold mt-1 text-red-600">{atRisk.length}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs uppercase text-muted-foreground tracking-wide">Critical (RUL &lt; 6mo)</p><p className="text-2xl font-bold mt-1 text-red-600">{assets.filter(a => a.remainingUsefulLifeMonths < 6).length}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs uppercase text-muted-foreground tracking-wide">Avg Remaining Life</p><p className="text-2xl font-bold mt-1">{avgRul} yr</p></CardContent></Card>
      </div>

      <div className="space-y-4">
        {ranked.map(a => {
          const prob = failureProbability(a);
          return (
            <Card key={a.assetId} className="hover:shadow-md transition-all duration-200">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${prob > 0.6 ? "bg-red-50 border border-red-100" : prob > 0.35 ? "bg-amber-50 border border-amber-100" : "bg-emerald-50 border border-emerald-100"}`}>
                      <Boxes className={`h-5 w-5 ${prob > 0.6 ? "text-red-600" : prob > 0.35 ? "text-amber-600" : "text-emerald-600"}`} />
                    </div>
                    <div>
                      <CardTitle className="text-base">{a.name}</CardTitle>
                      <CardDescription>{a.assetId} · {a.assetType.replace(/_/g, " ")} · {a.region}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2"><RiskBadge level={a.riskLevel} /><StatusBadge status={a.status} /></div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1"><span className="text-muted-foreground flex items-center gap-1"><TrendingDown className="h-3 w-3" /> Failure prob.</span><span className={`font-semibold ${prob > 0.6 ? "text-red-600" : prob > 0.35 ? "text-amber-600" : "text-emerald-600"}`}>{(prob * 100).toFixed(0)}%</span></div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden"><div className={`h-full ${prob > 0.6 ? "bg-red-500" : prob > 0.35 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${prob * 100}%` }} /></div>
                  </div>
                  <div className="text-sm"><p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Remaining life</p><p className="font-semibold">{a.remainingUsefulLifeMonths} months</p></div>
                  <div className="text-sm"><p className="text-xs text-muted-foreground">Health score</p><p className={`font-semibold ${a.healthScore < 50 ? "text-red-600" : a.healthScore < 75 ? "text-amber-600" : "text-emerald-600"}`}>{a.healthScore}</p></div>
                  <div className="text-sm"><p className="text-xs text-muted-foreground">Load stress</p><p className="font-semibold">{a.capacityMW ? Math.round(a.loadMW / a.capacityMW * 100) : 0}% ({formatMW(a.loadMW)})</p></div>
                </div>
                <div className="flex items-start gap-2 text-sm bg-muted/40 rounded-lg p-3">
                  <Wrench className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <span className="text-muted-foreground">{recommendation(a)}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
