import { getGridStats, demandForecasts } from "@/lib/data";

export async function GET() {
  return Response.json({ stats: getGridStats(), forecasts: demandForecasts });
}
