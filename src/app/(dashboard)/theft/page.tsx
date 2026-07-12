"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, RiskBadge } from "@/components/status-badge";
import { formatKWh } from "@/lib/format";
import { getTheftAlerts } from "@/lib/client-data";
import { ShieldAlert, Zap, TrendingDown } from "lucide-react";
import type { TheftAlert } from "@/types";

export default function TheftPage() {
  const [alerts] = useState<TheftAlert[]>(() => getTheftAlerts());
  const [selected, setSelected] = useState<TheftAlert | null>(() => getTheftAlerts()[0] ?? null);

  const open = alerts.filter(a => a.status === "OPEN" || a.status === "INVESTIGATING");
  const totalLoss = alerts.reduce((s, a) => s + a.estimatedLossKWh, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Energy-Theft Detection</h1>
        <p className="text-sm text-muted-foreground mt-1">AI revenue-protection — meter tampering &amp; consumption anomalies.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="pt-5"><p className="text-xs uppercase text-muted-foreground tracking-wide">Open Alerts</p><p className="text-2xl font-bold mt-1 text-amber-600">{open.length}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs uppercase text-muted-foreground tracking-wide">Critical</p><p className="text-2xl font-bold mt-1 text-red-600">{alerts.filter(a => a.severity === "CRITICAL").length}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs uppercase text-muted-foreground tracking-wide">Est. Energy Loss</p><p className="text-2xl font-bold mt-1">{formatKWh(totalLoss)}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs uppercase text-muted-foreground tracking-wide">Detection Rate</p><p className="text-2xl font-bold mt-1 text-emerald-600">96%</p></CardContent></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-2">
          {alerts.map(a => (
            <button key={a.alertId} onClick={() => setSelected(a)} className={`w-full text-left p-4 rounded-xl border transition-all ${selected?.alertId === a.alertId ? "border-emerald-300 bg-emerald-50/50 shadow-sm" : "hover:bg-muted/40"}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">{a.customer}</span>
                <RiskBadge level={a.severity} />
              </div>
              <p className="text-xs text-muted-foreground">{a.alertId} · {a.meterId}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-muted-foreground">Risk {a.riskScore}</span>
                <StatusBadge status={a.status} />
              </div>
            </button>
          ))}
        </div>

        {selected && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center">
                    <ShieldAlert className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{selected.customer}</CardTitle>
                    <CardDescription>{selected.alertId} · {selected.meterId} · {selected.region}</CardDescription>
                  </div>
                </div>
                <RiskBadge level={selected.severity} />
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Risk Score</p><p className="text-xl font-bold text-red-600">{selected.riskScore}</p></div>
                <div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Est. Loss</p><p className="text-xl font-bold">{formatKWh(selected.estimatedLossKWh)}</p></div>
                <div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Assigned</p><p className="text-sm font-semibold mt-1">{selected.assignedTo}</p></div>
              </div>

              <div>
                <p className="text-sm font-semibold mb-1 flex items-center gap-1.5"><Zap className="h-4 w-4 text-amber-500" /> {selected.detectionType}</p>
                <p className="text-sm text-muted-foreground">{selected.description}</p>
              </div>

              <div>
                <p className="text-sm font-semibold mb-2 flex items-center gap-1.5"><TrendingDown className="h-4 w-4 text-red-500" /> Contributing Factors</p>
                <ul className="space-y-1.5">
                  {selected.factors.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex gap-2 pt-2">
                <Button className="bg-gradient-to-r from-emerald-600 to-cyan-600">Dispatch Inspector</Button>
                <Button variant="outline">Mark Investigating</Button>
                <Button variant="outline">Dismiss</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
