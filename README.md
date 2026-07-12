# GridNextGen — Intelligent Utilities Management Platform

An AI-native control room for electric grid & utilities operations. GridNextGen demonstrates advanced, browser-native technical capabilities — WebGPU compute, WASM-style bulk validation, live SSE telemetry, an AI operator copilot, and a grid digital twin — applied to real-time energy operations.

Built with **Next.js 16**, **React 19**, **Tailwind CSS v4**, **Recharts**, and shadcn-style UI primitives. All data is local mock data served through Next.js API routes, so the demo runs fully offline with no external services.

## Features

| Area | Description |
|------|-------------|
| **Grid Dashboard** | Real-time load/generation balance, reserve margin, grid health, renewable mix, active outages, energy-theft alerts, auto-dispatch rate, 7-day demand forecast. |
| **Grid Assets** | Substations, transformers, lines, generators & storage with health scores, risk levels, utilization and per-asset load profiles. |
| **Smart Meters** | AMI fleet with validation state, anomaly scores and tamper detection. |
| **Outages** | Restoration workflow (Planned → Dispatched → In Progress → Restored) with crews, ETR and progress. |
| **Demand Forecast** | Base / Heatwave / Low-Renewables scenarios with reserve-margin and confidence projections. |
| **Energy-Theft Detection** | Risk-scored tamper/theft alerts with detection factors and investigation actions. |
| **Dispatch Approvals** | Multi-tier approval workflow for switching, load-shed, generation-dispatch and maintenance isolation. |
| **AI Grid Copilot** | Operator assistant answering load, outage-risk, asset-failure, theft and forecast questions with data cards & suggested actions. |
| **GPU Anomaly Scoring** | WebGPU/WGSL compute shader vs CPU scoring across smart-meter telemetry, with CPU↔GPU crossover analysis (CPU fallback when WebGPU is unavailable). |
| **WASM Meter Validator** | Bulk meter-reading validation comparing JS vs WASM-optimized throughput. |
| **Live Telemetry** | Server-Sent Events SCADA stream vs traditional polling. |
| **Digital Twin** | Contingency simulation (substation failure, heatwave, renewable intermittency) with demand/generation response and recovery outcomes. |
| **Predictive Asset Failure** | ML-ranked failure probability, remaining useful life and maintenance recommendations. |
| **Audit Trail** | Full history of platform actions. |

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Demo login

```
daniel.osei@gridnextgen.io / demo1234
```

## Scripts

```bash
npm run dev      # start dev server
npm run build    # production build
npm run lint     # eslint
npm run start    # serve production build
```

## Notes

- Data is in-memory mock data (`src/lib/`) served via `src/app/api/*` routes — replace with a time-series DB + SCADA/AMI feeds for production.
- The GPU page uses WebGPU when available and falls back to CPU scoring (with simulated GPU timing) otherwise.
