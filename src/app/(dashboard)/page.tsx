"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge, RiskBadge } from "@/components/status-badge";
import { formatMW, formatNumber } from "@/lib/format";
import { getGrid, getOutages } from "@/lib/client-data";
import {
  Gauge, Zap, TrendingUp, AlertTriangle, Activity, ShieldAlert, ArrowUpRight, Bot, Leaf,
} from "lucide-react";
import type { GridStats, Outage, DemandForecast } from "@/types";

function StatCard({ title, value, subtitle, icon: Icon, trend, gradient }: {
  title: string; value: string; subtitle: string; icon: React.ElementType; trend?: "up" | "down"; gradient?: string;
}) {
  return (
    <Card className="group hover:shadow-md transition-all duration-200 overflow-hidden relative">
      {gradient && <div className={`absolute inset-0 opacity-[0.05] ${gradient}`} />}
      <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</CardTitle>
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${gradient ?? "bg-muted"}`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
      </CardHeader>
      <CardContent className="relative">
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1.5">
          {trend === "up" && <ArrowUpRight className="h-3 w-3 text-emerald-500" />}
          {subtitle}
        </p>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const [stats] = useState<GridStats>(() => getGrid().stats);
  const [forecasts] = useState<DemandForecast[]>(() => getGrid().forecasts);
  const [outages] = useState<Outage[]>(() => getOutages().outages);

  const activeOutages = outages.filter(o => o.status !== "RESTORED").slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Grid Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Welcome back, Daniel. Real-time state of the network.</p>
        </div>
        <Button render={<Link href="/copilot" />} className="bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700 shadow-md shadow-emerald-500/20">
          <Bot className="h-4 w-4 mr-2" /> Ask Grid Copilot
        </Button>
      </div>

      {stats && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard title="System Load" value={formatMW(stats.currentLoadMW)} subtitle={`${formatMW(stats.generationMW)} generation online`} icon={Gauge} gradient="bg-gradient-to-br from-emerald-500 to-teal-600" />
            <StatCard title="Reserve Margin" value={`${stats.reserveMarginPct}%`} subtitle={`Frequency ${stats.frequencyHz.toFixed(2)} Hz`} icon={Activity} trend="up" gradient="bg-gradient-to-br from-cyan-500 to-blue-600" />
            <StatCard title="Active Outages" value={`${stats.activeOutages}`} subtitle={`${formatNumber(stats.customersAffected)} customers affected`} icon={AlertTriangle} gradient="bg-gradient-to-br from-amber-500 to-orange-600" />
            <StatCard title="Energy-Theft Alerts" value={`${stats.theftAlertsOpen}`} subtitle="Open — revenue protection" icon={ShieldAlert} gradient="bg-gradient-to-br from-red-500 to-rose-600" />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="hover:shadow-md transition-all duration-200">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Grid Health Score</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold bg-gradient-to-r from-emerald-500 to-teal-600 bg-clip-text text-transparent">{stats.gridHealthScore}</div>
                <p className="text-xs text-muted-foreground mt-2">
                  <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">
                    <TrendingUp className="h-3 w-3 mr-1" /> {stats.healthTrend}
                  </Badge>
                </p>
              </CardContent>
            </Card>
            <Card className="hover:shadow-md transition-all duration-200">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Renewable Mix</CardTitle>
                <Leaf className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold bg-gradient-to-r from-emerald-500 to-cyan-600 bg-clip-text text-transparent">{stats.renewableMixPct}%</div>
                <p className="text-xs text-muted-foreground mt-2">Solar + wind of online generation</p>
              </CardContent>
            </Card>
            <Card className="hover:shadow-md transition-all duration-200">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Auto-Dispatch Rate</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold bg-gradient-to-r from-cyan-500 to-blue-600 bg-clip-text text-transparent">{(stats.automationRate * 100).toFixed(0)}%</div>
                <p className="text-xs text-muted-foreground mt-2">Automated switching &amp; balancing</p>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="hover:shadow-md transition-all duration-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Active Outages &amp; Events</CardTitle>
                <CardDescription>Live grid incidents</CardDescription>
              </div>
              <Button variant="outline" size="sm" render={<Link href="/outages" />}>View All</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {activeOutages.map(o => (
                <div key={o.outageId} className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/60 transition-all duration-150">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 flex items-center justify-center">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{o.assetName}</p>
                      <p className="text-xs text-muted-foreground">{o.outageId} · {o.region} · {formatNumber(o.customersAffected)} affected</p>
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <RiskBadge level={o.severity} />
                    <div><StatusBadge status={o.status} /></div>
                  </div>
                </div>
              ))}
              {activeOutages.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">No active outages.</p>}
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-all duration-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">7-Day Demand Forecast</CardTitle>
                <CardDescription>Projected peak load &amp; renewables</CardDescription>
              </div>
              <Button variant="outline" size="sm" render={<Link href="/forecast" />}>Details</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {forecasts.map((f, i) => (
                <div key={f.date} className={`flex items-center justify-between p-2.5 rounded-lg ${i === 0 ? "bg-emerald-50/50 border border-emerald-100" : "hover:bg-muted/40"} transition-colors`}>
                  <div className="text-sm">
                    <p className="font-medium">{new Date(f.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</p>
                    <p className="text-[11px] text-muted-foreground">Peak {f.peakWindow} · {(f.confidence * 100).toFixed(0)}% conf.</p>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-emerald-600 font-medium">{formatMW(f.projectedRenewableMW)} RE</span>
                    <span className={`font-medium ${f.reserveMarginPct < 10 ? "text-red-500" : "text-muted-foreground"}`}>{f.reserveMarginPct}% rsv</span>
                    <span className="font-semibold w-24 text-right">{formatMW(f.projectedDemandMW)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
