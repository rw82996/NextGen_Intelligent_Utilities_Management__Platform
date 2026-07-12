"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { Search } from "lucide-react";
import type { AuditEvent } from "@/types";

const actionStyles: Record<string, string> = {
  CREATE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  APPROVE: "bg-blue-50 text-blue-700 border-blue-200",
  REJECT: "bg-red-50 text-red-700 border-red-200",
  UPDATE: "bg-amber-50 text-amber-700 border-amber-200",
  DELETE: "bg-red-50 text-red-700 border-red-200",
  DETECT: "bg-purple-50 text-purple-700 border-purple-200",
  ESCALATE: "bg-red-50 text-red-700 border-red-200",
  FLAG: "bg-amber-50 text-amber-700 border-amber-200",
  REVIEW: "bg-blue-50 text-blue-700 border-blue-200",
};

export default function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/audit").then(r => r.json()).then(setEvents);
  }, []);

  const filtered = events.filter(e =>
    e.description.toLowerCase().includes(search.toLowerCase()) ||
    e.userName.toLowerCase().includes(search.toLowerCase()) ||
    e.entityId.toLowerCase().includes(search.toLowerCase()) ||
    e.action.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit Trail</h1>
        <p className="text-muted-foreground">Complete history of all platform actions</p>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Activity Log</CardTitle>
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search audit trail..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>IP Address</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(e => (
                <TableRow key={e.eventId}>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{formatDateTime(e.timestamp)}</TableCell>
                  <TableCell className="font-medium">{e.userName}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border ${actionStyles[e.action] ?? "bg-slate-50 text-slate-600 border-slate-200"}`}>
                      {e.action}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-mono">{e.entityType}/{e.entityId}</span>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{e.description}</TableCell>
                  <TableCell className="text-sm text-muted-foreground font-mono">{e.ipAddress}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
