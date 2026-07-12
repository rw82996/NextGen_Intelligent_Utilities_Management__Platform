"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { formatKWh } from "@/lib/format";
import { Search, Gauge } from "lucide-react";
import type { SmartMeter } from "@/types";

export default function MetersPage() {
  const [meters, setMeters] = useState<SmartMeter[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => { fetch("/api/meters").then(r => r.json()).then(setMeters); }, []);

  const filtered = meters.filter(m =>
    m.meterId.toLowerCase().includes(search.toLowerCase()) ||
    m.customer.toLowerCase().includes(search.toLowerCase()) ||
    m.region.toLowerCase().includes(search.toLowerCase()));

  const normal = meters.filter(m => m.status === "NORMAL").length;
  const anomalies = meters.filter(m => m.status === "ANOMALY" || m.status === "TAMPER_SUSPECTED").length;
  const offline = meters.filter(m => m.status === "OFFLINE").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Smart Meters</h1>
        <p className="text-sm text-muted-foreground mt-1">AMI meter fleet — readings, validation &amp; anomaly scores.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="pt-5"><p className="text-xs uppercase text-muted-foreground tracking-wide">Total Meters</p><p className="text-2xl font-bold mt-1">{meters.length}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs uppercase text-muted-foreground tracking-wide">Normal</p><p className="text-2xl font-bold mt-1 text-emerald-600">{normal}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs uppercase text-muted-foreground tracking-wide">Anomalies</p><p className="text-2xl font-bold mt-1 text-amber-600">{anomalies}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs uppercase text-muted-foreground tracking-wide">Offline</p><p className="text-2xl font-bold mt-1 text-red-600">{offline}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><Gauge className="h-4 w-4" /> Meter Fleet</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search meters..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Meter</TableHead><TableHead>Segment</TableHead><TableHead>Feeder</TableHead>
                <TableHead>Last Reading</TableHead><TableHead>Avg Daily</TableHead><TableHead>Anomaly</TableHead>
                <TableHead>Validation</TableHead><TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(m => (
                <TableRow key={m.meterId}>
                  <TableCell>
                    <p className="font-medium text-sm">{m.customer}</p>
                    <p className="text-xs text-muted-foreground">{m.meterId}</p>
                  </TableCell>
                  <TableCell className="text-xs">{m.segment}</TableCell>
                  <TableCell className="text-xs">{m.feederId}</TableCell>
                  <TableCell className="text-sm">{formatKWh(m.lastReadingKWh)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatKWh(m.avgDailyKWh)}</TableCell>
                  <TableCell>
                    <span className={`text-sm font-semibold ${m.anomalyScore > 0.55 ? "text-red-600" : m.anomalyScore > 0.3 ? "text-amber-600" : "text-emerald-600"}`}>{(m.anomalyScore * 100).toFixed(0)}</span>
                  </TableCell>
                  <TableCell><StatusBadge status={m.validation} /></TableCell>
                  <TableCell><StatusBadge status={m.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
