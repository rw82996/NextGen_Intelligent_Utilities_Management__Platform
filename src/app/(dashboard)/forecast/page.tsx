"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, Sun, Thermometer } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { DemandForecast } from "@/types";

type Scenario = "BASE" | "HEATWAVE" | "LOW_RENEWABLE";

export default function ForecastPage() {
  const [forecasts, setForecasts] = useState<DemandForecast[]>([]);
  const [scenario, setScenario] = useState<Scenario>("BASE");

  useEffect(() => { fetch("/api/grid").then(r => r.json()).then(d => setForecasts(d.forecasts)); }, []);

  const adjusted = forecasts.map(f => {
    let demand = f.projectedDemandMW;
    let renewable = f.projectedRenewableMW;
    if (scenario === "HEATWAVE") demand = Math.round(demand * 1.14);
    if (scenario === "LOW_RENEWABLE") renewable = Math.round(renewable * 0.55);
    const generation = 5230;
    const reserve = Number((((generation + renewable - f.projectedRenewableMW) - demand) / demand * 100).toFixed(1));
    return {
      date: new Date(f.date).toLocaleDateString("en-US", { weekday: "short", day: "numeric" }),
      Demand: demand, Renewable: renewable,
      reserve, confidence: f.confidence, peakWindow: f.peakWindow,
    };
  });

  const minReserve = adjusted.length ? Math.min(...adjusted.map(a => a.reserve)) : 0;

  const scenarios: { id: Scenario; label: string; icon: React.ElementType }[] = [
    { id: "BASE", label: "Base Case", icon: TrendingUp },
    { id: "HEATWAVE", label: "Heatwave (+14% demand)", icon: Thermometer },
    { id: "LOW_RENEWABLE", label: "Low Renewables (−45%)", icon: Sun },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Demand Forecast</h1>
        <p className="text-sm text-muted-foreground mt-1">7-day probabilistic demand &amp; renewable-generation forecast.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {scenarios.map(s => (
          <Button key={s.id} variant={scenario === s.id ? "default" : "outline"} size="sm"
            className={scenario === s.id ? "bg-gradient-to-r from-emerald-600 to-cyan-600" : ""}
            onClick={() => setScenario(s.id)}>
            <s.icon className="h-4 w-4 mr-1.5" /> {s.label}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="pt-5"><p className="text-xs uppercase text-muted-foreground tracking-wide">Peak Demand</p><p className="text-2xl font-bold mt-1">{adjusted.length ? Math.max(...adjusted.map(a => a.Demand)).toLocaleString() : 0} MW</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs uppercase text-muted-foreground tracking-wide">Min Reserve Margin</p><p className={`text-2xl font-bold mt-1 ${minReserve < 8 ? "text-red-600" : minReserve < 12 ? "text-amber-600" : "text-emerald-600"}`}>{minReserve}%</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs uppercase text-muted-foreground tracking-wide">Forecast Confidence</p><p className="text-2xl font-bold mt-1">{adjusted.length ? (adjusted.reduce((s, a) => s + a.confidence, 0) / adjusted.length * 100).toFixed(0) : 0}%</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Demand vs Renewable Generation</CardTitle>
          <CardDescription>Projected MW — {scenarios.find(s => s.id === scenario)?.label}</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={adjusted}>
              <defs>
                <linearGradient id="demand" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0891b2" stopOpacity={0.3} /><stop offset="95%" stopColor="#0891b2" stopOpacity={0} /></linearGradient>
                <linearGradient id="renewable" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} />
              <Tooltip /><Legend />
              <Area type="monotone" dataKey="Demand" stroke="#0891b2" strokeWidth={2} fill="url(#demand)" />
              <Area type="monotone" dataKey="Renewable" stroke="#10b981" strokeWidth={2} fill="url(#renewable)" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Daily Breakdown</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-1">
            {adjusted.map(a => (
              <div key={a.date} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/40">
                <div className="text-sm"><p className="font-medium">{a.date}</p><p className="text-[11px] text-muted-foreground">Peak {a.peakWindow}</p></div>
                <div className="flex items-center gap-6 text-sm">
                  <span className="text-emerald-600">{a.Renewable.toLocaleString()} MW RE</span>
                  <span className={`font-medium ${a.reserve < 8 ? "text-red-500" : "text-muted-foreground"}`}>{a.reserve}% reserve</span>
                  <span className="font-semibold w-24 text-right">{a.Demand.toLocaleString()} MW</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
