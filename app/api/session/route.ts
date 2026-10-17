import { env, hasSlng } from "@/lib/env";
import { jsonResponse } from "@/lib/http";
import { SlngError, createWebSession } from "@/lib/slng";


export async function POST() {
  if (!hasSlng() || !process.env.SLNG_AGENT_ID) return jsonResponse({ error: "Live Call needs SLNG_API_KEY and SLNG_AGENT_ID" }, 503);
  try {
    const s = await createWebSession("citizen");
    return jsonResponse({ callId: s.call_id, roomName: s.room_name, livekitUrl: s.livekit_url, token: s.livekit_token, maxSeconds: s.max_session_seconds, agentId: env.slngAgentId });
  } catch (e) {
    const status = e instanceof SlngError ? e.status : 502;
    return jsonResponse({ error: e instanceof Error ? e.message : "Could not start live call" }, status);
  }
}
