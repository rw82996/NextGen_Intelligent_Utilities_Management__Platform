"use client";

const statusStyles: Record<string, string> = {
  // asset / grid
  ONLINE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  RESTORED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  NORMAL: "bg-emerald-50 text-emerald-700 border-emerald-200",
  VALID: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CONFIRMED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  DEGRADED: "bg-amber-50 text-amber-700 border-amber-200",
  MAINTENANCE: "bg-blue-50 text-blue-700 border-blue-200",
  PLANNED: "bg-slate-50 text-slate-600 border-slate-200",
  DISPATCHED: "bg-blue-50 text-blue-700 border-blue-200",
  IN_PROGRESS: "bg-blue-50 text-blue-700 border-blue-200",
  INVESTIGATING: "bg-blue-50 text-blue-700 border-blue-200",
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  WARNING: "bg-amber-50 text-amber-700 border-amber-200",
  ANOMALY: "bg-amber-50 text-amber-700 border-amber-200",
  OPEN: "bg-amber-50 text-amber-700 border-amber-200",
  ESCALATED: "bg-red-50 text-red-700 border-red-200",
  OFFLINE: "bg-red-50 text-red-700 border-red-200",
  FAULT: "bg-red-50 text-red-700 border-red-200",
  ERROR: "bg-red-50 text-red-700 border-red-200",
  TAMPER_SUSPECTED: "bg-red-50 text-red-700 border-red-200",
  REJECTED: "bg-red-50 text-red-700 border-red-200",
  DISMISSED: "bg-slate-50 text-slate-600 border-slate-200",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border ${statusStyles[status] ?? "bg-slate-50 text-slate-600 border-slate-200"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

const riskStyles: Record<string, string> = {
  LOW: "bg-emerald-50 text-emerald-700 border-emerald-200",
  MEDIUM: "bg-amber-50 text-amber-700 border-amber-200",
  HIGH: "bg-red-50 text-red-700 border-red-200",
  CRITICAL: "bg-red-100 text-red-800 border-red-300",
};

export function RiskBadge({ level }: { level: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border ${riskStyles[level] ?? "bg-slate-50 text-slate-600 border-slate-200"}`}>
      {level}
    </span>
  );
}
