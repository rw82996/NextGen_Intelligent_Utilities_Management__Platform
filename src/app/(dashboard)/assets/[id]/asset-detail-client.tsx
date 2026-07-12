"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, RiskBadge } from "@/components/status-badge";
import { formatMW, formatDate } from "@/lib/format";
import { getAssets } from "@/lib/client-data";
import { ArrowLeft, Activity } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import type { GridAsset } from "@/types";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2 border-b last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

export default function AssetDetailClient({ id }: { id: string }) {
  const [asset] = useState<GridAsset | null>(() => getAssets().find(a => a.assetId === id) ?? null);

  if (!asset) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;

  const loadTrend = Array.from({ length: 24 }, (_, h) => ({
    hour: `${h}:00`,
    load: Math.max(0, Math.round(asset.loadMW * (0.7 + 0.3 * Math.sin((h / 24) * Math.PI * 2 - 1.5)) + Math.sin(h * 1.7) * asset.loadMW * 0.04)),
  }));

  const utilization = asset.capacityMW ? Math.round((asset.loadMW / asset.capacityMW) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" render={<Link href="/assets" />}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{asset.name}</h1>
          <p className="text-muted-foreground text-sm">{asset.assetId} · {asset.assetType.replace(/_/g, " ")} · {asset.region}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <StatusBadge status={asset.status} /><RiskBadge level={asset.riskLevel} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="pt-5"><p className="text-xs uppercase text-muted-foreground tracking-wide">Health Score</p><p className={`text-2xl font-bold mt-1 ${asset.healthScore < 50 ? "text-red-600" : asset.healthScore < 75 ? "text-amber-600" : "text-emerald-600"}`}>{asset.healthScore}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs uppercase text-muted-foreground tracking-wide">Utilization</p><p className="text-2xl font-bold mt-1">{utilization}%</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs uppercase text-muted-foreground tracking-wide">Remaining Life</p><p className="text-2xl font-bold mt-1">{Math.round(asset.remainingUsefulLifeMonths / 12 * 10) / 10} yr</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs uppercase text-muted-foreground tracking-wide">Voltage</p><p className="text-2xl font-bold mt-1">{asset.voltageKV} kV</p></CardContent></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4" /> 24-Hour Load Profile</CardTitle>
            <CardDescription>Real-time telemetry (MW)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={loadTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="hour" tick={{ fontSize: 11 }} interval={3} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="load" stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Asset Details</CardTitle></CardHeader>
          <CardContent>
            <Row label="Capacity" value={formatMW(asset.capacityMW)} />
            <Row label="Current Load" value={formatMW(asset.loadMW)} />
            <Row label="Region" value={asset.region} />
            <Row label="Commissioned" value={formatDate(asset.commissionedAt)} />
            <Row label="Last Inspection" value={formatDate(asset.lastInspection)} />
            <Row label="Remaining Useful Life" value={`${asset.remainingUsefulLifeMonths} months`} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
