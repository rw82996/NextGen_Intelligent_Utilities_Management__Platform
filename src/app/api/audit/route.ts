import { auditEvents } from "@/lib/data";

export async function GET() {
  return Response.json(auditEvents);
}
