"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, RiskBadge } from "@/components/status-badge";
import { formatMW, formatDateTime } from "@/lib/format";
import { CheckCircle, XCircle, Zap } from "lucide-react";
import { toast } from "sonner";
import { getOutages } from "@/lib/client-data";
import type { DispatchOrder } from "@/types";

const typeLabels: Record<string, string> = {
  SWITCHING: "Switching Order", LOAD_SHED: "Load Shedding",
  GENERATION_DISPATCH: "Generation Dispatch", MAINTENANCE_ISOLATION: "Maintenance Isolation",
};

export default function DispatchPage() {
  const [orders, setOrders] = useState<DispatchOrder[]>(() => getOutages().dispatchOrders);

  function act(id: string, status: "APPROVED" | "REJECTED") {
    setOrders(prev => prev.map(o => o.orderId === id ? { ...o, status } : o));
    toast.success(`Order ${id} ${status.toLowerCase()}`);
  }

  const pending = orders.filter(o => o.status === "PENDING");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dispatch Approvals</h1>
        <p className="text-sm text-muted-foreground mt-1">Switching, load-shed, generation &amp; isolation orders requiring sign-off.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="pt-5"><p className="text-xs uppercase text-muted-foreground tracking-wide">Pending Approval</p><p className="text-2xl font-bold mt-1 text-amber-600">{pending.length}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs uppercase text-muted-foreground tracking-wide">Critical Orders</p><p className="text-2xl font-bold mt-1 text-red-600">{pending.filter(o => o.riskLevel === "CRITICAL").length}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs uppercase text-muted-foreground tracking-wide">Total Impact</p><p className="text-2xl font-bold mt-1">{formatMW(pending.reduce((s, o) => s + o.impactMW, 0))}</p></CardContent></Card>
      </div>

      <div className="space-y-4">
        {orders.map(o => (
          <Card key={o.orderId} className="hover:shadow-md transition-all duration-200">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-50 to-cyan-50 border border-emerald-100 flex items-center justify-center">
                    <Zap className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{typeLabels[o.dispatchType]} · {o.assetName}</CardTitle>
                    <CardDescription>{o.orderId} · {o.region} · requested by {o.requestedBy}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <RiskBadge level={o.riskLevel} /><StatusBadge status={o.status} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{o.description}</p>
              <div className="flex flex-wrap items-center gap-6 text-sm">
                <span><span className="text-muted-foreground">Impact:</span> <span className="font-medium">{formatMW(o.impactMW)}</span></span>
                <span><span className="text-muted-foreground">Approval level:</span> <span className="font-medium">L{o.approvalLevel}</span></span>
                <span><span className="text-muted-foreground">Approver:</span> <span className="font-medium">{o.approver}</span></span>
                <span className="text-muted-foreground">{formatDateTime(o.createdAt)}</span>
              </div>
              {o.status === "PENDING" && (
                <div className="flex gap-2 pt-1">
                  <Button size="sm" className="bg-gradient-to-r from-emerald-600 to-cyan-600" onClick={() => act(o.orderId, "APPROVED")}>
                    <CheckCircle className="h-4 w-4 mr-1.5" /> Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => act(o.orderId, "REJECTED")}>
                    <XCircle className="h-4 w-4 mr-1.5" /> Reject
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
