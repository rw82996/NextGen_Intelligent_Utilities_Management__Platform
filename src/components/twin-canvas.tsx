"use client";

import { useEffect, useRef } from "react";
import { BUSES, EDGES } from "@/lib/twin-topology";
import type { TwinSimFrame } from "@/workers/twin.worker";

// Fixed layout positions for the single-line diagram (canvas coordinate space).
const POSITIONS: Record<string, { x: number; y: number }> = {
  NORTHGATE: { x: 350, y: 55 },
  DOWNTOWN: { x: 140, y: 160 },
  SUBSTATION_B: { x: 350, y: 180 },
  WESTFIELD_SOLAR: { x: 240, y: 285 },
  INDUSTRIAL_CORRIDOR: { x: 350, y: 330 },
  BATTERY_SITE: { x: 460, y: 285 },
  SUBSTATION_C: { x: 560, y: 180 },
  HARBOR_GAS: { x: 660, y: 110 },
  SUBURBAN: { x: 660, y: 250 },
  CEDAR_ZONE: { x: 560, y: 340 },
};

const KIND_COLOR: Record<string, string> = {
  slack: "#0ea5e9", generation: "#10b981", load: "#64748b", hub: "#a855f7", storage: "#f59e0b",
};

export function TwinCanvas({ frame }: { frame: TwinSimFrame | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<TwinSimFrame | null>(frame);

  useEffect(() => {
    frameRef.current = frame;
  }, [frame]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf: number;

    function draw(t: number) {
      const c = frameRef.current;
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);

      // Edges
      for (const e of EDGES) {
        const a = POSITIONS[e.from], b = POSITIONS[e.to];
        const flow = c?.result.lineFlows.find((f) => f.from === e.from && f.to === e.to);
        const connected = flow ? flow.connected : true;

        ctx!.beginPath();
        ctx!.moveTo(a.x, a.y);
        ctx!.lineTo(b.x, b.y);
        if (!connected) {
          ctx!.strokeStyle = "#ef4444";
          ctx!.setLineDash([6, 6]);
          ctx!.lineDashOffset = 0;
          ctx!.lineWidth = 2;
        } else {
          const mag = flow ? Math.min(1, Math.abs(flow.flowMW) / 900) : 0.2;
          ctx!.strokeStyle = flow?.overloaded ? "#f59e0b" : "#10b981";
          ctx!.lineWidth = 1.5 + mag * 4;
          ctx!.setLineDash([10, 8]);
          // Marching dashes to suggest live power flow along the line.
          const dir = flow && flow.flowMW < 0 ? -1 : 1;
          ctx!.lineDashOffset = -((t / 40) % 18) * dir;
        }
        ctx!.stroke();
        ctx!.setLineDash([]);
      }

      // Buses
      BUSES.forEach((bus, i) => {
        const p = POSITIONS[bus.id];
        const reachable = c ? c.result.reachable[i] : true;
        const pulse = !reachable ? (Math.sin(t / 150) + 1) / 2 : 0;
        const r = 14 + (reachable ? 0 : pulse * 4);
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx!.fillStyle = reachable ? KIND_COLOR[bus.kind] : `rgba(239,68,68,${0.5 + pulse * 0.4})`;
        ctx!.fill();
        ctx!.lineWidth = 2;
        ctx!.strokeStyle = "#ffffff";
        ctx!.stroke();

        ctx!.fillStyle = "#334155";
        ctx!.font = "11px sans-serif";
        ctx!.textAlign = "center";
        ctx!.fillText(bus.name, p.x, p.y + r + 14);
        if (!reachable) {
          ctx!.fillStyle = "#dc2626";
          ctx!.font = "bold 10px sans-serif";
          ctx!.fillText("DE-ENERGIZED", p.x, p.y + r + 27);
        }
      });

      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvasRef} width={760} height={380} className="w-full h-auto rounded-xl border bg-white" />;
}
