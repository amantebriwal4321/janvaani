import { env, hasSlng } from "@/lib/env";

export async function GET() {
  const body = JSON.stringify({
    ok: true,
    slng: hasSlng(),
    liveCall: hasSlng() && Boolean(process.env.SLNG_AGENT_ID),
    region: env.slngRegion,
    byok: Boolean(env.byok.url && env.byok.key && env.byok.model),
  });
  // Explicit Content-Length so this doubles as a tiny non-chunked tunnel probe
  // (compare with /api/diag?kb=N for larger payloads).
  return new Response(body, {
    headers: { "Content-Type": "application/json", "Content-Length": String(Buffer.byteLength(body)), "Cache-Control": "no-store" },
  });
}
