import type {
  GridAsset, SmartMeter, Outage, DemandForecast, GridStats,
  DispatchOrder, AuditEvent,
} from "@/types";

// In-memory data store for the demo. Replace with a time-series DB + SCADA feed in production.

export const gridAssets: GridAsset[] = [
  { assetId: "SUB-NORTH-01", name: "Northgate 345kV Substation", assetType: "SUBSTATION", region: "North", status: "ONLINE", capacityMW: 900, loadMW: 742, voltageKV: 345, healthScore: 94, riskLevel: "LOW", remainingUsefulLifeMonths: 168, lastInspection: "2026-05-12", commissionedAt: "2009-06-01" },
  { assetId: "TX-NORTH-14", name: "Northgate Transformer T14", assetType: "TRANSFORMER", region: "North", status: "DEGRADED", capacityMW: 250, loadMW: 233, voltageKV: 138, healthScore: 61, riskLevel: "HIGH", remainingUsefulLifeMonths: 14, lastInspection: "2026-03-02", commissionedAt: "2001-09-15" },
  { assetId: "LINE-E-220", name: "East Corridor 220kV Line", assetType: "TRANSMISSION_LINE", region: "East", status: "ONLINE", capacityMW: 600, loadMW: 410, voltageKV: 220, healthScore: 88, riskLevel: "LOW", remainingUsefulLifeMonths: 96, lastInspection: "2026-04-20", commissionedAt: "2013-02-01" },
  { assetId: "FDR-CITY-07", name: "Downtown Feeder 07", assetType: "DISTRIBUTION_FEEDER", region: "Central", status: "ONLINE", capacityMW: 45, loadMW: 41, voltageKV: 13, healthScore: 79, riskLevel: "MEDIUM", remainingUsefulLifeMonths: 42, lastInspection: "2026-06-01", commissionedAt: "2016-11-10" },
  { assetId: "GEN-CCGT-02", name: "Riverside CCGT Unit 2", assetType: "GENERATOR", region: "South", status: "ONLINE", capacityMW: 480, loadMW: 455, voltageKV: 18, healthScore: 91, riskLevel: "LOW", remainingUsefulLifeMonths: 132, lastInspection: "2026-05-28", commissionedAt: "2015-04-01" },
  { assetId: "SOLAR-W-01", name: "Westfield Solar Farm", assetType: "SOLAR_FARM", region: "West", status: "ONLINE", capacityMW: 320, loadMW: 214, voltageKV: 34, healthScore: 96, riskLevel: "LOW", remainingUsefulLifeMonths: 240, lastInspection: "2026-06-10", commissionedAt: "2021-08-01" },
  { assetId: "WIND-N-03", name: "Northern Ridge Wind", assetType: "WIND_FARM", region: "North", status: "MAINTENANCE", capacityMW: 280, loadMW: 0, voltageKV: 34, healthScore: 72, riskLevel: "MEDIUM", remainingUsefulLifeMonths: 180, lastInspection: "2026-06-18", commissionedAt: "2019-03-01" },
  { assetId: "BESS-C-01", name: "Central Battery Storage", assetType: "BATTERY_STORAGE", region: "Central", status: "ONLINE", capacityMW: 150, loadMW: -85, voltageKV: 34, healthScore: 89, riskLevel: "LOW", remainingUsefulLifeMonths: 108, lastInspection: "2026-05-30", commissionedAt: "2022-07-01" },
  { assetId: "TX-SOUTH-09", name: "Southbank Transformer T9", assetType: "TRANSFORMER", region: "South", status: "FAULT", capacityMW: 200, loadMW: 0, voltageKV: 138, healthScore: 38, riskLevel: "CRITICAL", remainingUsefulLifeMonths: 3, lastInspection: "2026-02-14", commissionedAt: "1998-05-20" },
  { assetId: "SUB-EAST-04", name: "Eastport 138kV Substation", assetType: "SUBSTATION", region: "East", status: "ONLINE", capacityMW: 520, loadMW: 388, voltageKV: 138, healthScore: 85, riskLevel: "LOW", remainingUsefulLifeMonths: 120, lastInspection: "2026-05-05", commissionedAt: "2011-10-01" },
  { assetId: "FDR-IND-12", name: "Industrial Park Feeder 12", assetType: "DISTRIBUTION_FEEDER", region: "South", status: "DEGRADED", capacityMW: 60, loadMW: 57, voltageKV: 13, healthScore: 55, riskLevel: "HIGH", remainingUsefulLifeMonths: 20, lastInspection: "2026-01-18", commissionedAt: "2008-06-15" },
  { assetId: "LINE-W-500", name: "West Interconnect 500kV", assetType: "TRANSMISSION_LINE", region: "West", status: "ONLINE", capacityMW: 1200, loadMW: 870, voltageKV: 500, healthScore: 92, riskLevel: "LOW", remainingUsefulLifeMonths: 156, lastInspection: "2026-04-30", commissionedAt: "2017-12-01" },
];

const segments = ["RESIDENTIAL", "COMMERCIAL", "INDUSTRIAL"] as const;
const regions = ["North", "South", "East", "West", "Central"];
const customers = ["Elm St Residence", "Harbor Logistics", "Metro Foods", "Cedar Apartments", "Precision Mfg", "Sunrise Bakery", "Oakwood Clinic", "Bayside Hotel", "Greenfield Farm", "Summit Data Center", "Lakeside Mall", "Ironworks Plant"];

export const smartMeters: SmartMeter[] = Array.from({ length: 14 }, (_, i) => {
  const anomalyScore = i % 5 === 0 ? 0.6 + Math.random() * 0.4 : Math.random() * 0.3;
  const status = anomalyScore > 0.8 ? "TAMPER_SUSPECTED" : anomalyScore > 0.55 ? "ANOMALY" : i % 11 === 0 ? "OFFLINE" : "NORMAL";
  const validation = status === "OFFLINE" ? "ERROR" : anomalyScore > 0.55 ? "WARNING" : "VALID";
  const avg = 20 + Math.round(Math.random() * 400);
  return {
    meterId: `MTR-${String(100000 + i * 337).slice(0, 6)}`,
    customer: customers[i % customers.length],
    segment: segments[i % segments.length],
    feederId: `FDR-${regions[i % regions.length].slice(0, 3).toUpperCase()}-${(i % 12) + 1}`,
    region: regions[i % regions.length],
    status,
    validation,
    lastReadingKWh: Math.max(0, Math.round(avg * (status === "OFFLINE" ? 0 : anomalyScore > 0.55 ? 0.25 : 0.9 + Math.random() * 0.2))),
    avgDailyKWh: avg,
    anomalyScore: Number(anomalyScore.toFixed(2)),
    lastReadingAt: `2026-07-08T0${i % 6}:${String(10 + i).padStart(2, "0")}:00Z`,
  };
});

export const outages: Outage[] = [
  { outageId: "OUT-2026-041", region: "South", assetId: "TX-SOUTH-09", assetName: "Southbank Transformer T9", cause: "EQUIPMENT_FAILURE", severity: "CRITICAL", status: "IN_PROGRESS", customersAffected: 12480, loadLostMW: 88, description: "Transformer T9 tripped on differential protection. Insulation failure suspected. Load transferred to adjacent bus, partial restoration underway.", crewAssigned: "Line Crew Alpha", restorationProgress: 55, etr: "2026-07-08T05:30:00Z", reportedAt: "2026-07-08T01:12:00Z" },
  { outageId: "OUT-2026-042", region: "North", assetId: "LINE-E-220", assetName: "East Corridor 220kV Line", cause: "WEATHER", severity: "HIGH", status: "DISPATCHED", customersAffected: 5400, loadLostMW: 42, description: "Lightning strike on tower 118 caused a phase-to-ground fault. Auto-recloser locked out. Crew dispatched to inspect insulators.", crewAssigned: "Line Crew Bravo", restorationProgress: 20, etr: "2026-07-08T06:15:00Z", reportedAt: "2026-07-08T02:05:00Z" },
  { outageId: "OUT-2026-043", region: "Central", assetId: "FDR-CITY-07", assetName: "Downtown Feeder 07", cause: "OVERLOAD", severity: "MEDIUM", status: "ESCALATED", customersAffected: 2100, loadLostMW: 12, description: "Feeder 07 exceeded thermal rating during morning ramp. Protective relay operated. Load-balancing to Feeder 08 required.", crewAssigned: "Ops Desk", restorationProgress: 35, etr: "2026-07-08T04:45:00Z", reportedAt: "2026-07-08T02:40:00Z" },
  { outageId: "OUT-2026-044", region: "South", assetId: "FDR-IND-12", assetName: "Industrial Park Feeder 12", cause: "VEGETATION", severity: "MEDIUM", status: "PLANNED", customersAffected: 340, loadLostMW: 6, description: "Planned isolation for vegetation clearance near span 12-14. Coordinated with Precision Mfg for backup generation.", crewAssigned: "Vegetation Crew", restorationProgress: 0, etr: "2026-07-08T09:00:00Z", reportedAt: "2026-07-07T18:00:00Z" },
  { outageId: "OUT-2026-039", region: "East", assetId: "SUB-EAST-04", assetName: "Eastport 138kV Substation", cause: "PLANNED_MAINTENANCE", severity: "LOW", status: "RESTORED", customersAffected: 0, loadLostMW: 0, description: "Scheduled breaker maintenance on Bus 2 completed successfully. All feeders returned to service.", crewAssigned: "Substation Crew", restorationProgress: 100, etr: "2026-07-07T14:00:00Z", reportedAt: "2026-07-07T08:00:00Z", restoredAt: "2026-07-07T13:42:00Z" },
  { outageId: "OUT-2026-045", region: "West", assetId: "WIND-N-03", assetName: "Northern Ridge Wind", cause: "CYBER", severity: "HIGH", status: "IN_PROGRESS", customersAffected: 0, loadLostMW: 55, description: "Anomalous SCADA commands detected on wind farm controller. Isolated from network as precaution; security team investigating.", crewAssigned: "OT Security", restorationProgress: 40, etr: "2026-07-08T07:00:00Z", reportedAt: "2026-07-08T00:20:00Z" },
];

export const demandForecasts: DemandForecast[] = [
  { date: "2026-07-08", projectedDemandMW: 4820, projectedRenewableMW: 1640, reserveMarginPct: 14.2, confidence: 0.96, peakWindow: "18:00–20:00" },
  { date: "2026-07-09", projectedDemandMW: 4950, projectedRenewableMW: 1720, reserveMarginPct: 12.8, confidence: 0.93, peakWindow: "18:00–20:00" },
  { date: "2026-07-10", projectedDemandMW: 5210, projectedRenewableMW: 1490, reserveMarginPct: 9.4, confidence: 0.9, peakWindow: "17:00–19:00" },
  { date: "2026-07-11", projectedDemandMW: 5380, projectedRenewableMW: 1380, reserveMarginPct: 7.1, confidence: 0.87, peakWindow: "17:00–19:00" },
  { date: "2026-07-12", projectedDemandMW: 4610, projectedRenewableMW: 1910, reserveMarginPct: 18.3, confidence: 0.84, peakWindow: "19:00–21:00" },
  { date: "2026-07-13", projectedDemandMW: 4480, projectedRenewableMW: 2050, reserveMarginPct: 20.1, confidence: 0.81, peakWindow: "19:00–21:00" },
  { date: "2026-07-14", projectedDemandMW: 4990, projectedRenewableMW: 1600, reserveMarginPct: 11.5, confidence: 0.78, peakWindow: "18:00–20:00" },
];

export const dispatchOrders: DispatchOrder[] = [
  { orderId: "DSP-3001", dispatchType: "LOAD_SHED", assetName: "Downtown Feeder 07", region: "Central", impactMW: 12, riskLevel: "HIGH", status: "PENDING", approvalLevel: 2, requestedBy: "Ops Desk", approver: "Maria Alvarez", description: "Shed 12 MW on Feeder 07 to relieve thermal overload during morning ramp.", createdAt: "2026-07-08T02:41:00Z" },
  { orderId: "DSP-3002", dispatchType: "SWITCHING", assetName: "Southbank Transformer T9", region: "South", impactMW: 88, riskLevel: "CRITICAL", status: "PENDING", approvalLevel: 3, requestedBy: "Line Crew Alpha", approver: "Grid Control", description: "Isolate faulted T9 and transfer load to T10 via bus tie. High-impact switching sequence.", createdAt: "2026-07-08T01:20:00Z" },
  { orderId: "DSP-3003", dispatchType: "GENERATION_DISPATCH", assetName: "Riverside CCGT Unit 2", region: "South", impactMW: 60, riskLevel: "MEDIUM", status: "PENDING", approvalLevel: 1, requestedBy: "Market Ops", approver: "Maria Alvarez", description: "Ramp CCGT Unit 2 up by 60 MW to cover reserve shortfall from wind farm isolation.", createdAt: "2026-07-08T00:55:00Z" },
  { orderId: "DSP-2999", dispatchType: "MAINTENANCE_ISOLATION", assetName: "Eastport 138kV Substation", region: "East", impactMW: 0, riskLevel: "LOW", status: "APPROVED", approvalLevel: 1, requestedBy: "Substation Crew", approver: "Maria Alvarez", description: "Isolate Bus 2 for scheduled breaker maintenance.", createdAt: "2026-07-07T07:50:00Z" },
];

export const auditEvents: AuditEvent[] = [
  { eventId: "aud-001", userId: "user-001", userName: "Daniel Osei", entityType: "DISPATCH", entityId: "DSP-3002", action: "CREATE", description: "Requested critical switching order to isolate Southbank Transformer T9", ipAddress: "10.20.1.45", timestamp: "2026-07-08T01:20:00Z" },
  { eventId: "aud-002", userId: "user-002", userName: "Maria Alvarez", entityType: "OUTAGE", entityId: "OUT-2026-045", action: "ESCALATE", description: "Escalated wind farm cyber event to OT Security team", ipAddress: "10.20.1.52", timestamp: "2026-07-08T00:25:00Z" },
  { eventId: "aud-003", userId: "user-003", userName: "System", entityType: "THEFT", entityId: "THF-001", action: "DETECT", description: "AI model flagged meter MTR-100000 for suspected tampering (risk 92)", ipAddress: "10.20.9.10", timestamp: "2026-07-08T00:10:00Z" },
  { eventId: "aud-004", userId: "user-002", userName: "Maria Alvarez", entityType: "DISPATCH", entityId: "DSP-2999", action: "APPROVE", description: "Approved maintenance isolation for Eastport Bus 2", ipAddress: "10.20.1.52", timestamp: "2026-07-07T07:52:00Z" },
  { eventId: "aud-005", userId: "user-001", userName: "Daniel Osei", entityType: "ASSET", entityId: "TX-SOUTH-09", action: "FLAG", description: "Flagged Southbank Transformer T9 for predictive failure (RUL 3 months)", ipAddress: "10.20.1.45", timestamp: "2026-07-07T22:00:00Z" },
  { eventId: "aud-006", userId: "user-004", userName: "Priya Nair", entityType: "FORECAST", entityId: "FC-2026-07-11", action: "REVIEW", description: "Reviewed low reserve margin (7.1%) forecast for Jul 11 peak window", ipAddress: "10.20.1.60", timestamp: "2026-07-07T20:15:00Z" },
];

export function getGridStats(): GridStats {
  const active = outages.filter(o => o.status !== "RESTORED");
  const generation = gridAssets
    .filter(a => ["GENERATOR", "SOLAR_FARM", "WIND_FARM", "BATTERY_STORAGE"].includes(a.assetType))
    .reduce((s, a) => s + Math.max(0, a.loadMW), 0);
  const renewable = gridAssets
    .filter(a => ["SOLAR_FARM", "WIND_FARM"].includes(a.assetType))
    .reduce((s, a) => s + Math.max(0, a.loadMW), 0);
  const currentLoad = 4820;
  return {
    currentLoadMW: currentLoad,
    generationMW: 5230,
    reserveMarginPct: 14.2,
    gridHealthScore: 87,
    healthTrend: "STABLE",
    renewableMixPct: Math.round((renewable / (generation || 1)) * 100),
    activeOutages: active.length,
    customersAffected: active.reduce((s, o) => s + o.customersAffected, 0),
    theftAlertsOpen: 3,
    automationRate: 0.94,
    frequencyHz: 60.01,
  };
}
