import { gridAssets } from "@/lib/data";

export async function GET() {
  return Response.json(gridAssets);
}
