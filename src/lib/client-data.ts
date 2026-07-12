// Client-side data access — replaces the server API routes so the whole app
// runs in the browser (static export, GitHub Pages). Data is local mock data;
// swap these for a time-series DB + SCADA/AMI feeds in production.

import {
  gridAssets,
  smartMeters,
  outages,
  demandForecasts,
  dispatchOrders,
  auditEvents,
  getGridStats,
} from "@/lib/data";
import { theftAlerts } from "@/lib/theft";
import type {
  GridAsset,
  SmartMeter,
  Outage,
  DemandForecast,
  DispatchOrder,
  AuditEvent,
  TheftAlert,
  GridStats,
} from "@/types";

export function getGrid(): { stats: GridStats; forecasts: DemandForecast[] } {
  return { stats: getGridStats(), forecasts: demandForecasts };
}

export function getAssets(): GridAsset[] {
  return gridAssets;
}

export function getMeters(): SmartMeter[] {
  return smartMeters;
}

export function getOutages(): { outages: Outage[]; dispatchOrders: DispatchOrder[] } {
  return { outages, dispatchOrders };
}

export function getTheftAlerts(): TheftAlert[] {
  return theftAlerts;
}

export function getAuditEvents(): AuditEvent[] {
  return auditEvents;
}

export interface DemoUser {
  userId: string;
  name: string;
  email: string;
  role: string;
  orgId: string;
}

const demoUsers: Record<string, { password: string; user: DemoUser }> = {
  "daniel.osei@gridnextgen.io": {
    password: "demo1234",
    user: { userId: "user-001", name: "Daniel Osei", email: "daniel.osei@gridnextgen.io", role: "GRID_OPERATOR", orgId: "utility-001" },
  },
  "maria.alvarez@gridnextgen.io": {
    password: "demo1234",
    user: { userId: "user-002", name: "Maria Alvarez", email: "maria.alvarez@gridnextgen.io", role: "CONTROL_ROOM_LEAD", orgId: "utility-001" },
  },
};

export function authenticate(email: string, password: string): DemoUser | null {
  const entry = demoUsers[email];
  if (entry && entry.password === password) return entry.user;
  return null;
}

// Compact snapshot of live grid state used as RAG context for the local LLM.
export function buildGridContext(): string {
  const stats = getGridStats();
  const active = outages.filter((o) => o.status !== "RESTORED");
  const atRisk = gridAssets
    .filter((a) => a.riskLevel === "HIGH" || a.riskLevel === "CRITICAL")
    .sort((a, b) => a.healthScore - b.healthScore);
  const openTheft = theftAlerts.filter((a) => a.status === "OPEN" || a.status === "INVESTIGATING");
  const pending = dispatchOrders.filter((d) => d.status === "PENDING");

  const lines: string[] = [];
  lines.push(
    `GRID STATE: system load ${stats.currentLoadMW} MW, generation online ${stats.generationMW} MW, ` +
      `reserve margin ${stats.reserveMarginPct}%, frequency ${stats.frequencyHz} Hz, renewable mix ${stats.renewableMixPct}%, ` +
      `grid health ${stats.gridHealthScore} (${stats.healthTrend}), active outages ${stats.activeOutages}.`,
  );
  lines.push(
    `ACTIVE OUTAGES (${active.length}): ` +
      (active
        .map((o) => `${o.outageId} ${o.assetName}/${o.region} [${o.severity}] cause=${o.cause} customers=${o.customersAffected} loadLost=${o.loadLostMW}MW status=${o.status}`)
        .join("; ") || "none"),
  );
  lines.push(
    `AT-RISK ASSETS (${atRisk.length}): ` +
      (atRisk
        .map((a) => `${a.assetId} ${a.name} [${a.riskLevel}] health=${a.healthScore} RUL=${a.remainingUsefulLifeMonths}mo`)
        .join("; ") || "none"),
  );
  lines.push(
    `OPEN THEFT ALERTS (${openTheft.length}): ` +
      (openTheft
        .map((t) => `${t.alertId} ${t.customer} [${t.severity}] risk=${t.riskScore} lossKWh=${t.estimatedLossKWh}`)
        .join("; ") || "none"),
  );
  lines.push(
    `PENDING DISPATCH APPROVALS (${pending.length}): ` +
      (pending.map((d) => `${d.orderId} ${d.dispatchType} [${d.riskLevel}] ${d.description}`).join("; ") ||
        "none"),
  );
  lines.push(
    `DEMAND FORECAST (next days): ` +
      demandForecasts
        .slice(0, 7)
        .map((f) => `${f.date} peak=${f.projectedDemandMW}MW renewable=${f.projectedRenewableMW}MW reserve=${f.reserveMarginPct}%`)
        .join("; "),
  );
  return lines.join("\n");
}

export const GRID_COPILOT_SYSTEM_PROMPT =
  "You are Grid Copilot, an AI assistant for electric-utility grid operators. " +
  "Answer using ONLY the grid state provided in the context. Be concise and operational: " +
  "prioritise safety, reliability and reserve margin. Use short paragraphs and bullet lists. " +
  "If the context does not contain the answer, say so briefly.";
