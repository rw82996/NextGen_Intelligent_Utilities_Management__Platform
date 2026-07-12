import { theftAlerts } from "@/lib/theft";

export async function GET() {
  return Response.json(theftAlerts);
}
