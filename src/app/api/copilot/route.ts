import { getCopilotResponse } from "@/lib/theft";

export async function POST(request: Request) {
  const body = await request.json() as { message: string };
  const response = getCopilotResponse(body.message);
  return Response.json(response);
}
