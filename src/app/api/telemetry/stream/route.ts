import { telemetrySeed, type TelemetryChannel } from "@/lib/edge";

export const dynamic = "force-dynamic";

function jitter(ch: TelemetryChannel): TelemetryChannel {
  const swing = ch.channelId === "FREQ" ? 0.05 : ch.nominal * 0.06;
  const value = Number((ch.value + (Math.random() - 0.5) * swing).toFixed(ch.channelId === "FREQ" ? 3 : 1));
  const dev = Math.abs(value - ch.nominal) / (ch.nominal || 1);
  const status: TelemetryChannel["status"] =
    ch.channelId === "TX-N-14" ? (value > 82 ? "ALARM" : "WARNING")
    : dev > 0.08 ? "WARNING"
    : "NORMAL";
  return { ...ch, value, status, updatedAt: new Date().toISOString() };
}

export async function GET() {
  const encoder = new TextEncoder();
  let channels = telemetrySeed.map((c) => ({ ...c }));

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "init", channels })}\n\n`));

      const interval = setInterval(() => {
        const idx = Math.floor(Math.random() * channels.length);
        channels = channels.map((c, i) => (i === idx ? jitter(c) : c));
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "update", channel: channels[idx] })}\n\n`)
        );
      }, 1500);

      setTimeout(() => {
        clearInterval(interval);
        try { controller.close(); } catch { /* already closed */ }
      }, 120000);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
