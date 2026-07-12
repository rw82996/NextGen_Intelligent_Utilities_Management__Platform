import type { TheftAlert, CopilotMessage } from "@/types";

export const theftAlerts: TheftAlert[] = [
  {
    alertId: "THF-001", meterId: "MTR-100000", customer: "Ironworks Plant", region: "South",
    severity: "CRITICAL", status: "OPEN", riskScore: 92,
    detectionType: "Meter Tampering + Consumption Drop",
    factors: ["Consumption dropped 78% while feeder load unchanged", "Reverse-current events detected", "Physical seal status reported broken", "Night-time usage spikes inconsistent with metered total"],
    estimatedLossKWh: 48200,
    description: "Industrial meter shows a sharp consumption drop with no corresponding load reduction on the feeder. Reverse-current signatures indicate a bypass or tampering.",
    assignedTo: "Revenue Protection", createdAt: "2026-07-08T00:10:00Z",
  },
  {
    alertId: "THF-002", meterId: "MTR-101011", customer: "Harbor Logistics", region: "North",
    severity: "HIGH", status: "INVESTIGATING", riskScore: 78,
    detectionType: "Consumption Anomaly",
    factors: ["Usage 4x below segment average for 12 consecutive days", "Load profile flat despite active operations", "Neighboring meters show normal patterns"],
    estimatedLossKWh: 21400,
    description: "Commercial meter consumption is far below expectation for an active logistics site. Pattern consistent with partial bypass.",
    assignedTo: "Field Inspector", createdAt: "2026-07-07T21:30:00Z",
  },
  {
    alertId: "THF-003", meterId: "MTR-102022", customer: "Cedar Apartments", region: "East",
    severity: "MEDIUM", status: "OPEN", riskScore: 54,
    detectionType: "Billing Pattern Deviation",
    factors: ["Sudden 35% drop after meter access event", "Estimated reads for 3 cycles"],
    estimatedLossKWh: 6800,
    description: "Residential complex meter shows a step-change reduction following a maintenance access event. Flagged for physical verification.",
    assignedTo: "Unassigned", createdAt: "2026-07-07T18:00:00Z",
  },
  {
    alertId: "THF-004", meterId: "MTR-103033", customer: "Sunrise Bakery", region: "Central",
    severity: "LOW", status: "DISMISSED", riskScore: 28,
    detectionType: "Seasonal Variance",
    factors: ["Consumption drop within seasonal range", "Owner confirmed reduced operating hours"],
    estimatedLossKWh: 0,
    description: "Initial anomaly attributed to reduced summer operating hours. Confirmed legitimate — closed.",
    assignedTo: "Revenue Protection", createdAt: "2026-07-06T14:00:00Z",
  },
];

export const copilotSuggestions = [
  "Where is my highest outage risk right now?",
  "Show grid load and reserve margin",
  "Which assets are most likely to fail?",
  "Summarize open energy-theft alerts",
  "What's the demand forecast for peak this week?",
  "Which switching orders need my approval?",
];

export function getCopilotResponse(message: string): CopilotMessage {
  const lower = message.toLowerCase();

  if (lower.includes("load") || lower.includes("reserve") || lower.includes("balance")) {
    return {
      id: crypto.randomUUID(), role: "assistant", timestamp: new Date().toISOString(),
      content: "Current system load is **4,820 MW** against **5,230 MW** of committed generation, leaving a **14.2% reserve margin**. Grid frequency is stable at **60.01 Hz**.",
      data: [
        { label: "System Load", value: "4,820 MW", type: "metric" },
        { label: "Generation Online", value: "5,230 MW", type: "metric" },
        { label: "Reserve Margin", value: "14.2%", type: "metric" },
        { label: "Renewable Mix", value: "28%", type: "metric" },
      ],
      suggestedActions: [
        { label: "View Dashboard", action: "/", variant: "default" },
        { label: "See Demand Forecast", action: "/forecast", variant: "outline" },
      ],
    };
  }

  if (lower.includes("outage") || lower.includes("risk") || lower.includes("highest")) {
    return {
      id: crypto.randomUUID(), role: "assistant", timestamp: new Date().toISOString(),
      content: "Your **highest outage risk** is in the **South region**. There are **5 active outages** affecting ~20K customers:",
      data: [
        { label: "OUT-2026-041 · Southbank Transformer T9", value: "CRITICAL · 12,480 customers · 88 MW lost", type: "alert" },
        { label: "OUT-2026-045 · Northern Ridge Wind (cyber)", value: "HIGH · 55 MW isolated", type: "alert" },
        { label: "OUT-2026-042 · East Corridor 220kV (weather)", value: "HIGH · 5,400 customers", type: "alert" },
      ],
      suggestedActions: [
        { label: "Open Outage Console", action: "/outages", variant: "default" },
        { label: "Review Dispatch Orders", action: "/dispatch", variant: "outline" },
      ],
    };
  }

  if (lower.includes("fail") || lower.includes("asset") || lower.includes("maintenance")) {
    return {
      id: crypto.randomUUID(), role: "assistant", timestamp: new Date().toISOString(),
      content: "Predictive models flag **3 assets** at elevated failure risk within the next 12 months:",
      data: [
        { label: "TX-SOUTH-09 · Southbank Transformer T9", value: "CRITICAL · RUL 3 months · health 38", type: "asset" },
        { label: "TX-NORTH-14 · Northgate Transformer T14", value: "HIGH · RUL 14 months · health 61", type: "asset" },
        { label: "FDR-IND-12 · Industrial Park Feeder 12", value: "HIGH · RUL 20 months · health 55", type: "asset" },
      ],
      suggestedActions: [
        { label: "View Predictive Maintenance", action: "/predictive", variant: "default" },
        { label: "View Grid Assets", action: "/assets", variant: "outline" },
      ],
    };
  }

  if (lower.includes("theft") || lower.includes("tamper") || lower.includes("fraud")) {
    return {
      id: crypto.randomUUID(), role: "assistant", timestamp: new Date().toISOString(),
      content: "There are **3 open energy-theft alerts** — 1 critical, 1 high, 1 medium — with an estimated **76,400 kWh** unbilled:",
      data: [
        { label: "THF-001 · CRITICAL · Ironworks Plant", value: "Meter tampering + reverse current · 48.2K kWh", type: "alert" },
        { label: "THF-002 · HIGH · Harbor Logistics", value: "Consumption 4x below average · 21.4K kWh", type: "alert" },
        { label: "THF-003 · MEDIUM · Cedar Apartments", value: "Step-change after access event · 6.8K kWh", type: "alert" },
      ],
      suggestedActions: [
        { label: "Open Theft Detection", action: "/theft", variant: "default" },
      ],
    };
  }

  if (lower.includes("forecast") || lower.includes("demand") || lower.includes("peak")) {
    return {
      id: crypto.randomUUID(), role: "assistant", timestamp: new Date().toISOString(),
      content: "The tightest day this week is **Jul 11**, with projected peak demand of **5,380 MW** and a reserve margin dropping to **7.1%** during the 17:00–19:00 window.\n\n- Consider pre-positioning battery storage discharge\n- Ramp Riverside CCGT Unit 2 ahead of the ramp\n- Prepare demand-response for large industrial customers",
      data: [
        { label: "Jul 11 Peak Demand", value: "5,380 MW", type: "metric" },
        { label: "Reserve Margin (min)", value: "7.1%", type: "metric" },
        { label: "Renewable Contribution", value: "1,380 MW", type: "metric" },
      ],
      suggestedActions: [
        { label: "View Demand Forecast", action: "/forecast", variant: "default" },
      ],
    };
  }

  if (lower.includes("switch") || lower.includes("dispatch") || lower.includes("approv")) {
    return {
      id: crypto.randomUUID(), role: "assistant", timestamp: new Date().toISOString(),
      content: "There are **3 dispatch orders** awaiting approval:",
      data: [
        { label: "DSP-3002 · Southbank T9 isolation", value: "CRITICAL · 88 MW · Level 3", type: "alert" },
        { label: "DSP-3001 · Feeder 07 load shed", value: "HIGH · 12 MW · Level 2", type: "asset" },
        { label: "DSP-3003 · CCGT Unit 2 ramp +60 MW", value: "MEDIUM · Level 1", type: "asset" },
      ],
      suggestedActions: [
        { label: "Go to Dispatch Approvals", action: "/dispatch", variant: "default" },
      ],
    };
  }

  return {
    id: crypto.randomUUID(), role: "assistant", timestamp: new Date().toISOString(),
    content: `I understand you're asking about "${message}". Here's what I can help you with:\n\n- **Grid Operations**: load, generation, reserve margin, frequency\n- **Outages**: highest-risk regions, restoration progress, dispatch\n- **Assets**: health, predictive failure, maintenance planning\n- **Revenue Protection**: energy-theft alerts and consumption anomalies\n- **Forecasting**: demand and renewable generation, peak windows\n\nTry "Where is my highest outage risk right now?" or "Which assets are most likely to fail?"`,
    suggestedActions: [
      { label: "View Dashboard", action: "/", variant: "default" },
    ],
  };
}
