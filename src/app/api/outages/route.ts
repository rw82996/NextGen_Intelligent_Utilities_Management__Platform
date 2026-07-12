import { outages, dispatchOrders } from "@/lib/data";

export async function GET() {
  return Response.json({ outages, dispatchOrders });
}
