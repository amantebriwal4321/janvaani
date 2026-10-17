import { NextRequest } from "next/server";
import { hasSlng } from "@/lib/env";
import { SlngError, transcribe } from "@/lib/slng";
import { DEFAULTS, LANG_IDS, type Lang, type SttModelId } from "@/lib/models";
import { jsonResponse } from "@/lib/http";


const MODELS = new Set<string>(["sarvam/saaras:v3", "slng/deepgram/nova:3-hi", "soniox/speech-ai:rt-v5"]);
const LANGS = new Set<string>(LANG_IDS);

// Body: raw PCM 16-bit little-endian mono at 16 kHz (application/octet-stream).
export async function POST(req: NextRequest) {
  if (!hasSlng()) return jsonResponse({ error: "SLNG_API_KEY is not set. Voice is disabled; use the text box." }, 503);
  const model = (req.nextUrl.searchParams.get("model") ?? DEFAULTS.stt) as SttModelId;
  if (!MODELS.has(model)) return jsonResponse({ error: "Unknown STT model" }, 400);
  const langParam = req.nextUrl.searchParams.get("lang");
  const lang = langParam && LANGS.has(langParam) ? (langParam as Lang) : undefined;

  const pcm = Buffer.from(await req.arrayBuffer());
  if (pcm.length < 3200) return jsonResponse({ error: "Recording too short. Hold the button and speak for at least a second." }, 400);
  if (pcm.length > 16000 * 2 * 60) return jsonResponse({ error: "Recording longer than 60 seconds" }, 413);

  try {
    const r = await transcribe(pcm, model, lang);
    return jsonResponse({ transcript: r.transcript, ms: r.ms, model: r.model, audioSeconds: pcm.length / 32000, requestId: r.requestId });
  } catch (e) {
    const status = e instanceof SlngError ? e.status : 502;
    return jsonResponse({ error: e instanceof Error ? e.message : "STT failed" }, status);
  }
}
