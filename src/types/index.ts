// Domain model for the Intelligent Utilities Management Platform (Energy Grid)

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

// ---- Grid assets ----

export type AssetType =
  | "SUBSTATION"
  | "TRANSFORMER"
  | "TRANSMISSION_LINE"
  | "DISTRIBUTION_FEEDER"
  | "GENERATOR"
  | "BATTERY_STORAGE"
  | "SOLAR_FARM"
  | "WIND_FARM";

export type AssetStatus =
  | "ONLINE"
  | "DEGRADED"
  | "MAINTENANCE"
  | "OFFLINE"
  | "FAULT";

export interface GridAsset {
  assetId: string;
  name: string;
  assetType: AssetType;
  region: string;
  status: AssetStatus;
  capacityMW: number;
  loadMW: number;
  voltageKV: number;
  healthScore: number; // 0-100
  riskLevel: RiskLevel;
  remainingUsefulLifeMonths: number;
  lastInspection: string;
  commissionedAt: string;
}

// ---- Smart meters ----

export type MeterStatus = "NORMAL" | "ANOMALY" | "OFFLINE" | "TAMPER_SUSPECTED";
export type MeterValidation = "VALID" | "WARNING" | "ERROR";

export interface SmartMeter {
  meterId: string;
  customer: string;
  segment: "RESIDENTIAL" | "COMMERCIAL" | "INDUSTRIAL";
  feederId: string;
  region: string;
  status: MeterStatus;
  validation: MeterValidation;
  lastReadingKWh: number;
  avgDailyKWh: number;
  anomalyScore: number; // 0-1
  lastReadingAt: string;
}

// ---- Outages / grid events ----

export type OutageStatus = "PLANNED" | "DISPATCHED" | "IN_PROGRESS" | "RESTORED" | "ESCALATED";
export type OutageSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type OutageCause =
  | "EQUIPMENT_FAILURE"
  | "WEATHER"
  | "OVERLOAD"
  | "VEGETATION"
  | "CYBER"
  | "PLANNED_MAINTENANCE";

export interface Outage {
  outageId: string;
  region: string;
  assetId: string;
  assetName: string;
  cause: OutageCause;
  severity: OutageSeverity;
  status: OutageStatus;
  customersAffected: number;
  loadLostMW: number;
  description: string;
  crewAssigned: string;
  restorationProgress: number; // 0-100
  etr: string; // estimated time of restoration
  reportedAt: string;
  restoredAt?: string;
}

// ---- Forecasts ----

export interface DemandForecast {
  date: string;
  projectedDemandMW: number;
  projectedRenewableMW: number;
  reserveMarginPct: number;
  confidence: number;
  peakWindow: string;
}

// ---- Dashboard ----

export interface GridStats {
  currentLoadMW: number;
  generationMW: number;
  reserveMarginPct: number;
  gridHealthScore: number;
  healthTrend: "IMPROVING" | "STABLE" | "DECLINING";
  renewableMixPct: number;
  activeOutages: number;
  customersAffected: number;
  theftAlertsOpen: number;
  automationRate: number; // automated dispatch success
  frequencyHz: number;
}

// ---- Energy theft detection ----

export type TheftSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type TheftStatus = "OPEN" | "INVESTIGATING" | "CONFIRMED" | "DISMISSED";

export interface TheftAlert {
  alertId: string;
  meterId: string;
  customer: string;
  region: string;
  severity: TheftSeverity;
  status: TheftStatus;
  riskScore: number; // 0-100
  detectionType: string;
  factors: string[];
  estimatedLossKWh: number;
  description: string;
  assignedTo: string;
  createdAt: string;
}

// ---- Dispatch / switching approvals ----

export type DispatchStatus = "PENDING" | "APPROVED" | "REJECTED";
export type DispatchType = "SWITCHING" | "LOAD_SHED" | "GENERATION_DISPATCH" | "MAINTENANCE_ISOLATION";

export interface DispatchOrder {
  orderId: string;
  dispatchType: DispatchType;
  assetName: string;
  region: string;
  impactMW: number;
  riskLevel: RiskLevel;
  status: DispatchStatus;
  approvalLevel: number;
  requestedBy: string;
  approver: string;
  description: string;
  createdAt: string;
}

// ---- Audit ----

export interface AuditEvent {
  eventId: string;
  userId: string;
  userName: string;
  entityType: string;
  entityId: string;
  action: string;
  description: string;
  ipAddress: string;
  timestamp: string;
}

// ---- Copilot ----

export interface CopilotMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  data?: CopilotDataItem[];
  suggestedActions?: CopilotAction[];
}

export interface CopilotDataItem {
  label: string;
  value: string;
  type?: "asset" | "alert" | "metric";
}

export interface CopilotAction {
  label: string;
  action: string;
  variant?: "default" | "outline";
}
