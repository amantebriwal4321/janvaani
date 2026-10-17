import { env, hasSlng } from "@/lib/env";
import { SlngError, createWebSession } from "@/lib/slng";

export const runtime = "nodejs";

export async function POST() {
  if (!hasSlng() || !process.env.SLNG_AGENT_ID) return Response.json({ error: "Live Call needs SLNG_API_KEY and SLNG_AGENT_ID" }, { status: 503 });
  try {
    const s = await createWebSession("citizen");
    return Response.json({ callId: s.call_id, roomName: s.room_name, livekitUrl: s.livekit_url, token: s.livekit_token, maxSeconds: s.max_session_seconds, agentId: env.slngAgentId });
  } catch (e) {
    const status = e instanceof SlngError ? e.status : 502;
    return Response.json({ error: e instanceof Error ? e.message : "Could not start live call" }, { status });
  }
}
