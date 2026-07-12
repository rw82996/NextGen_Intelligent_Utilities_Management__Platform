"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge, RiskBadge } from "@/components/status-badge";
import { formatMW } from "@/lib/format";
import { getAssets } from "@/lib/client-data";
import { Search, Network } from "lucide-react";
import type { GridAsset } from "@/types";

export default function AssetsPage() {
  const router = useRouter();
  const [assets] = useState<GridAsset[]>(() => getAssets());
  const [search, setSearch] = useState("");

  const filtered = assets.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.assetId.toLowerCase().includes(search.toLowerCase()) ||
    a.region.toLowerCase().includes(search.toLowerCase()));

  const online = assets.filter(a => a.status === "ONLINE").length;
  const atRisk = assets.filter(a => a.riskLevel === "HIGH" || a.riskLevel === "CRITICAL").length;
  const totalCap = assets.reduce((s, a) => s + a.capacityMW, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Grid Assets</h1>
        <p className="text-sm text-muted-foreground mt-1">Substations, transformers, lines, feeders &amp; generation.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="pt-5"><p className="text-xs uppercase text-muted-foreground tracking-wide">Total Assets</p><p className="text-2xl font-bold mt-1">{assets.length}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs uppercase text-muted-foreground tracking-wide">Online</p><p className="text-2xl font-bold mt-1 text-emerald-600">{online}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs uppercase text-muted-foreground tracking-wide">At Risk</p><p className="text-2xl font-bold mt-1 text-red-600">{atRisk}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs uppercase text-muted-foreground tracking-wide">Installed Capacity</p><p className="text-2xl font-bold mt-1">{formatMW(totalCap)}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><Network className="h-4 w-4" /> Asset Register</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search assets..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead><TableHead>Type</TableHead><TableHead>Region</TableHead>
                <TableHead>Load / Capacity</TableHead><TableHead>Health</TableHead><TableHead>Risk</TableHead><TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(a => (
                <TableRow key={a.assetId} className="cursor-pointer" onClick={() => router.push(`/assets/${a.assetId}`)}>
                  <TableCell>
                    <p className="font-medium text-sm">{a.name}</p>
                    <p className="text-xs text-muted-foreground">{a.assetId}</p>
                  </TableCell>
                  <TableCell className="text-xs">{a.assetType.replace(/_/g, " ")}</TableCell>
                  <TableCell className="text-sm">{a.region}</TableCell>
                  <TableCell className="text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className={`h-full ${a.loadMW / a.capacityMW > 0.9 ? "bg-red-500" : a.loadMW / a.capacityMW > 0.75 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, Math.max(0, (a.loadMW / a.capacityMW) * 100))}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground">{formatMW(a.loadMW)}/{formatMW(a.capacityMW)}</span>
                    </div>
                  </TableCell>
                  <TableCell><span className={`text-sm font-semibold ${a.healthScore < 50 ? "text-red-600" : a.healthScore < 75 ? "text-amber-600" : "text-emerald-600"}`}>{a.healthScore}</span></TableCell>
                  <TableCell><RiskBadge level={a.riskLevel} /></TableCell>
                  <TableCell><StatusBadge status={a.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
