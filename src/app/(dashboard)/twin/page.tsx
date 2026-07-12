"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, Play, Zap, AlertTriangle, CheckCircle, Thermometer, Sun } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

type ScenarioId = "SUBSTATION_FAILURE" | "HEATWAVE" | "RENEWABLE_INTERMITTENCY";

interface Scenario {
  id: ScenarioId;
  label: string;
  icon: React.ElementType;
  description: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
}

const scenarios: Scenario[] = [
  { id: "SUBSTATION_FAILURE", label: "Substation Failure", icon: AlertTriangle, description: "Trip Northgate 345kV substation (742 MW) and simulate load transfer & recovery.", severity: "CRITICAL" },
  { id: "HEATWAVE", label: "Heatwave Demand Spike", icon: Thermometer, description: "Sustained +18% demand surge stressing reserve margin and thermal limits.", severity: "HIGH" },
  { id: "RENEWABLE_INTERMITTENCY", label: "Renewable Intermittency", icon: Sun, description: "Sudden cloud front cuts solar by 60%; battery + gas ramp to compensate.", severity: "MEDIUM" },
];

interface SimStep { t: string; demand: number; generation: number; }
interface SimResult {
  steps: SimStep[];
  minReserve: number;
  loadShedMW: number;
  recoveryMin: number;
  batteryDispatchMW: number;
  outcome: string;
  stable: boolean;
}

function simulate(id: ScenarioId): SimResult {
  const baseDemand = 4820;
  const baseGen = 5230;
  const steps: SimStep[] = [];
  let loadShed = 0, minReserve = 100, recovery = 0, battery = 0;

  for (let m = 0; m <= 30; m += 2) {
    let demand = baseDemand, generation = baseGen;
    if (id === "SUBSTATION_FAILURE") {
      if (m >= 2 && m < 10) generation = baseGen - 742 + (m - 2) * 60;
      else if (m >= 10) generation = baseGen - Math.max(0, 742 - (m - 2) * 60);
      if (m >= 2 && m < 8) { loadShed = Math.max(loadShed, 320); battery = 150; }
    } else if (id === "HEATWAVE") {
      demand = baseDemand * (1 + 0.18 * Math.min(1, m / 12));
      generation = baseGen + Math.min(400, m * 20);
      if (demand > generation) { loadShed = Math.max(loadShed, Math.round(demand - generation)); battery = 150; }
    } else {
      if (m >= 4 && m < 16) generation = baseGen - 190 + (m - 4) * 12;
      battery = m >= 4 && m < 16 ? 150 : 0;
    }
    const reserve = Number(((generation - demand) / demand * 100).toFixed(1));
    minReserve = Math.min(minReserve, reserve);
    if (reserve < 5 && recovery === 0) recovery = 0;
    steps.push({ t: `${m}m`, demand: Math.round(demand), generation: Math.round(generation) });
  }

  const lastReserve = (steps[steps.length - 1].generation - steps[steps.length - 1].demand) / steps[steps.length - 1].demand * 100;
  recovery = id === "SUBSTATION_FAILURE" ? 18 : id === "HEATWAVE" ? 24 : 12;
  const stable = lastReserve >= 8;

  const outcome = id === "SUBSTATION_FAILURE"
    ? "Automatic load transfer to adjacent buses restored 742 MW over 18 min. 320 MW temporary load-shed avoided cascading failure; battery bridged the gap. Grid returned to stable reserve margin."
    : id === "HEATWAVE"
    ? "Peaking generation + demand-response + 150 MW battery discharge covered the surge. Reserve margin dipped to a minimum but stayed positive; no firm load lost after DR activation."
    : "60% solar loss was absorbed by 150 MW battery discharge and fast gas ramp within 12 min. Frequency held within ±0.05 Hz; no customer impact.";

  return { steps, minReserve, loadShedMW: loadShed, recoveryMin: recovery, batteryDispatchMW: battery > 0 ? 150 : 0, outcome, stable };
}

export default function DigitalTwinPage() {
  const [selected, setSelected] = useState<ScenarioId>("SUBSTATION_FAILURE");
  const [result, setResult] = useState<SimResult | null>(null);
  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    setResult(null);
    await new Promise(r => setTimeout(r, 600));
    setResult(simulate(selected));
    setRunning(false);
  }

  const scen = scenarios.find(s => s.id === selected)!;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Grid Digital Twin</h1>
        <p className="text-sm text-muted-foreground mt-1">Simulate contingencies against a live model of the network before they happen.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {scenarios.map(s => (
          <button key={s.id} onClick={() => { setSelected(s.id); setResult(null); }} className={`text-left p-4 rounded-xl border transition-all ${selected === s.id ? "border-emerald-300 bg-emerald-50/50 shadow-sm" : "hover:bg-muted/40"}`}>
            <div className="flex items-center gap-2 mb-2">
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${s.severity === "CRITICAL" ? "bg-red-100" : s.severity === "HIGH" ? "bg-amber-100" : "bg-blue-100"}`}>
                <s.icon className={`h-4 w-4 ${s.severity === "CRITICAL" ? "text-red-600" : s.severity === "HIGH" ? "text-amber-600" : "text-blue-600"}`} />
              </div>
              <span className="font-semibold text-sm">{s.label}</span>
            </div>
            <p className="text-xs text-muted-foreground">{s.description}</p>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Selected scenario: <span className="font-medium text-foreground">{scen.label}</span></p>
        <Button onClick={run} disabled={running} className="bg-gradient-to-r from-emerald-600 to-cyan-600">
          <Play className="h-4 w-4 mr-1.5" /> {running ? "Simulating..." : "Run Simulation"}
        </Button>
      </div>

      {result && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card><CardContent className="pt-5"><p className="text-xs uppercase text-muted-foreground tracking-wide">Min Reserve Margin</p><p className={`text-2xl font-bold mt-1 ${result.minReserve < 5 ? "text-red-600" : result.minReserve < 10 ? "text-amber-600" : "text-emerald-600"}`}>{result.minReserve}%</p></CardContent></Card>
            <Card><CardContent className="pt-5"><p className="text-xs uppercase text-muted-foreground tracking-wide">Load Shed</p><p className="text-2xl font-bold mt-1">{result.loadShedMW} MW</p></CardContent></Card>
            <Card><CardContent className="pt-5"><p className="text-xs uppercase text-muted-foreground tracking-wide">Battery Dispatch</p><p className="text-2xl font-bold mt-1">{result.batteryDispatchMW} MW</p></CardContent></Card>
            <Card><CardContent className="pt-5"><p className="text-xs uppercase text-muted-foreground tracking-wide">Recovery Time</p><p className="text-2xl font-bold mt-1">{result.recoveryMin} min</p></CardContent></Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4" /> Demand vs Generation Response</CardTitle>
              <CardDescription>30-minute contingency simulation</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={result.steps}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="t" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} domain={["dataMin - 200", "dataMax + 200"]} />
                  <Tooltip /><Legend />
                  <Line type="monotone" dataKey="demand" name="Demand (MW)" stroke="#0891b2" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="generation" name="Generation (MW)" stroke="#10b981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className={result.stable ? "border-emerald-200 bg-emerald-50/30" : "border-amber-200 bg-amber-50/30"}>
            <CardContent className="pt-5">
              <div className="flex items-start gap-3">
                {result.stable ? <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" /> : <Zap className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />}
                <div>
                  <p className="font-semibold text-sm mb-1">{result.stable ? "Grid Remains Stable" : "Grid Stressed — Mitigations Required"}</p>
                  <p className="text-sm text-muted-foreground">{result.outcome}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!result && !running && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground space-y-3 rounded-xl border border-dashed">
          <Activity className="h-8 w-8 text-slate-300" />
          <span className="text-sm">Select a scenario and click Run Simulation</span>
        </div>
      )}
    </div>
  );
}
