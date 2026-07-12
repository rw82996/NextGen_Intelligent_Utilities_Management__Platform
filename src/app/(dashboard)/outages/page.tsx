"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatusBadge, RiskBadge } from "@/components/status-badge";
import { formatMW, formatNumber, formatDateTime } from "@/lib/format";
import { getOutages } from "@/lib/client-data";
import { AlertTriangle, Users, Clock, Wrench } from "lucide-react";
import type { Outage } from "@/types";

const causeLabels: Record<string, string> = {
  EQUIPMENT_FAILURE: "Equipment Failure", WEATHER: "Weather", OVERLOAD: "Overload",
  VEGETATION: "Vegetation", CYBER: "Cyber Event", PLANNED_MAINTENANCE: "Planned Maintenance",
};

export default function OutagesPage() {
  const [outages] = useState<Outage[]>(() => getOutages().outages);

  const active = outages.filter(o => o.status !== "RESTORED");
  const totalCustomers = active.reduce((s, o) => s + o.customersAffected, 0);
  const totalLoad = active.reduce((s, o) => s + o.loadLostMW, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Outage Management</h1>
        <p className="text-sm text-muted-foreground mt-1">Active incidents, restoration progress &amp; crew dispatch.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="pt-5"><p className="text-xs uppercase text-muted-foreground tracking-wide">Active Outages</p><p className="text-2xl font-bold mt-1 text-amber-600">{active.length}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs uppercase text-muted-foreground tracking-wide">Customers Affected</p><p className="text-2xl font-bold mt-1">{formatNumber(totalCustomers)}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs uppercase text-muted-foreground tracking-wide">Load Lost</p><p className="text-2xl font-bold mt-1 text-red-600">{formatMW(totalLoad)}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs uppercase text-muted-foreground tracking-wide">Critical</p><p className="text-2xl font-bold mt-1 text-red-600">{active.filter(o => o.severity === "CRITICAL").length}</p></CardContent></Card>
      </div>

      <div className="space-y-4">
        {outages.map(o => (
          <Card key={o.outageId} className="hover:shadow-md transition-all duration-200">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${o.severity === "CRITICAL" ? "bg-red-50 border border-red-100" : "bg-amber-50 border border-amber-100"}`}>
                    <AlertTriangle className={`h-5 w-5 ${o.severity === "CRITICAL" ? "text-red-600" : "text-amber-600"}`} />
                  </div>
                  <div>
                    <CardTitle className="text-base">{o.assetName}</CardTitle>
                    <CardDescription>{o.outageId} · {o.region} · {causeLabels[o.cause]}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <RiskBadge level={o.severity} /><StatusBadge status={o.status} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{o.description}</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground" /><span>{formatNumber(o.customersAffected)} customers</span></div>
                <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-muted-foreground" /><span>{formatMW(o.loadLostMW)} lost</span></div>
                <div className="flex items-center gap-2"><Wrench className="h-4 w-4 text-muted-foreground" /><span>{o.crewAssigned}</span></div>
                <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /><span>ETR {formatDateTime(o.etr)}</span></div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Restoration progress</span>
                  <span className="font-medium">{o.restorationProgress}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full transition-all ${o.restorationProgress === 100 ? "bg-emerald-500" : "bg-gradient-to-r from-emerald-500 to-cyan-500"}`} style={{ width: `${o.restorationProgress}%` }} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
