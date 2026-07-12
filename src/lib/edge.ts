// Edge computing data — WebGPU meter anomaly scoring, SSE telemetry, WASM validation

export interface MeterReadingFeature {
  meterId: string;
  customer: string;
  lastReadingKWh: number;
  consumptionVsAvg: number;   // ratio: this reading / 30-day average
  meterAgeHours: number;       // hours since meter last serviced/installed
  reverseFlowEvents: number;   // count of reverse-current events in 24h
  tamperRiskScore: number;     // 0-1 physical seal / access risk
  nightUsageRatio: number;     // 0-1 share of usage outside expected hours
  feederImbalance: number;     // 0-1 mismatch vs feeder aggregate
}

export const meterReadings: MeterReadingFeature[] = [
  { meterId: "MTR-100000", customer: "Ironworks Plant", lastReadingKWh: 120, consumptionVsAvg: 0.22, meterAgeHours: 40000, reverseFlowEvents: 6, tamperRiskScore: 0.9, nightUsageRatio: 0.85, feederImbalance: 0.88 },
  { meterId: "MTR-100337", customer: "Harbor Logistics", lastReadingKWh: 90, consumptionVsAvg: 0.25, meterAgeHours: 22000, reverseFlowEvents: 2, tamperRiskScore: 0.6, nightUsageRatio: 0.4, feederImbalance: 0.55 },
  { meterId: "MTR-100674", customer: "Metro Foods", lastReadingKWh: 310, consumptionVsAvg: 1.02, meterAgeHours: 8000, reverseFlowEvents: 0, tamperRiskScore: 0.05, nightUsageRatio: 0.1, feederImbalance: 0.08 },
  { meterId: "MTR-101011", customer: "Cedar Apartments", lastReadingKWh: 65, consumptionVsAvg: 0.35, meterAgeHours: 15000, reverseFlowEvents: 1, tamperRiskScore: 0.45, nightUsageRatio: 0.5, feederImbalance: 0.42 },
  { meterId: "MTR-101348", customer: "Precision Mfg", lastReadingKWh: 520, consumptionVsAvg: 0.98, meterAgeHours: 30000, reverseFlowEvents: 0, tamperRiskScore: 0.1, nightUsageRatio: 0.2, feederImbalance: 0.12 },
  { meterId: "MTR-101685", customer: "Ironworks Plant", lastReadingKWh: 40, consumptionVsAvg: 0.12, meterAgeHours: 48000, reverseFlowEvents: 8, tamperRiskScore: 0.95, nightUsageRatio: 0.9, feederImbalance: 0.92 },
  { meterId: "MTR-102022", customer: "Sunrise Bakery", lastReadingKWh: 145, consumptionVsAvg: 0.95, meterAgeHours: 6000, reverseFlowEvents: 0, tamperRiskScore: 0.05, nightUsageRatio: 0.15, feederImbalance: 0.06 },
  { meterId: "MTR-102359", customer: "Oakwood Clinic", lastReadingKWh: 210, consumptionVsAvg: 1.05, meterAgeHours: 9000, reverseFlowEvents: 0, tamperRiskScore: 0.08, nightUsageRatio: 0.25, feederImbalance: 0.1 },
  { meterId: "MTR-102696", customer: "Bayside Hotel", lastReadingKWh: 480, consumptionVsAvg: 1.1, meterAgeHours: 12000, reverseFlowEvents: 0, tamperRiskScore: 0.06, nightUsageRatio: 0.3, feederImbalance: 0.09 },
  { meterId: "MTR-103033", customer: "Greenfield Farm", lastReadingKWh: 55, consumptionVsAvg: 0.3, meterAgeHours: 26000, reverseFlowEvents: 3, tamperRiskScore: 0.5, nightUsageRatio: 0.45, feederImbalance: 0.48 },
  { meterId: "MTR-103370", customer: "Summit Data Center", lastReadingKWh: 980, consumptionVsAvg: 1.0, meterAgeHours: 4000, reverseFlowEvents: 0, tamperRiskScore: 0.03, nightUsageRatio: 0.4, feederImbalance: 0.05 },
  { meterId: "MTR-103707", customer: "Lakeside Mall", lastReadingKWh: 70, consumptionVsAvg: 0.28, meterAgeHours: 33000, reverseFlowEvents: 5, tamperRiskScore: 0.82, nightUsageRatio: 0.7, feederImbalance: 0.78 },
];

// Weights for the meter anomaly / theft scoring model (simulates a trained network)
export const modelWeights = {
  consumptionVsAvg: 0.24,
  meterAge: 0.14,
  reverseFlow: 0.2,
  tamperRisk: 0.22,
  nightUsage: 0.1,
  feederImbalance: 0.16,
  bias: -0.2,
};

// CPU-based scoring for comparison
export function cpuScoreReading(m: MeterReadingFeature): number {
  const w = modelWeights;
  const ageNorm = Math.min(m.meterAgeHours / 43800, 1.0);
  const dropNorm = Math.min(Math.max(1 - m.consumptionVsAvg, 0), 1.0); // bigger drop => higher risk
  const revNorm = Math.min(m.reverseFlowEvents / 8, 1.0);

  const raw =
    dropNorm * w.consumptionVsAvg +
    ageNorm * w.meterAge +
    revNorm * w.reverseFlow +
    m.tamperRiskScore * w.tamperRisk +
    m.nightUsageRatio * w.nightUsage +
    m.feederImbalance * w.feederImbalance +
    w.bias;

  return 1 / (1 + Math.exp(-raw * 6));
}

// SSE: grid telemetry channels streamed in real time
export interface TelemetryChannel {
  channelId: string;
  name: string;
  unit: string;
  value: number;
  nominal: number;
  status: "NORMAL" | "WARNING" | "ALARM";
  updatedAt: string;
}

export const telemetrySeed: TelemetryChannel[] = [
  { channelId: "LOAD", name: "System Load", unit: "MW", value: 4820, nominal: 4800, status: "NORMAL", updatedAt: new Date().toISOString() },
  { channelId: "FREQ", name: "Grid Frequency", unit: "Hz", value: 60.01, nominal: 60.0, status: "NORMAL", updatedAt: new Date().toISOString() },
  { channelId: "SUB-N-01", name: "Northgate Substation Load", unit: "MW", value: 742, nominal: 750, status: "NORMAL", updatedAt: new Date().toISOString() },
  { channelId: "TX-N-14", name: "Transformer T14 Temp", unit: "°C", value: 78, nominal: 65, status: "WARNING", updatedAt: new Date().toISOString() },
  { channelId: "SOLAR-W", name: "Westfield Solar Output", unit: "MW", value: 214, nominal: 220, status: "NORMAL", updatedAt: new Date().toISOString() },
];
