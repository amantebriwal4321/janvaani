import { env, hasSlng } from "@/lib/env";

export async function GET() {
  return Response.json({
    ok: true,
    slng: hasSlng(),
    liveCall: hasSlng() && Boolean(process.env.SLNG_AGENT_ID),
    region: env.slngRegion,
    byok: Boolean(env.byok.url && env.byok.key && env.byok.model),
  });
}
