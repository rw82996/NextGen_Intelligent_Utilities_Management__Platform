import { smartMeters } from "@/lib/data";

export async function GET() {
  return Response.json(smartMeters);
}
