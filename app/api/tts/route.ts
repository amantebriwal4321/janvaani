import { NextRequest } from "next/server";
import { z } from "zod";
import { hasSlng } from "@/lib/env";
import { SlngError, synthesize } from "@/lib/slng";
import { DEFAULTS, LANG_IDS } from "@/lib/models";
import { jsonResponse } from "@/lib/http";


const Body = z.object({
  text: z.string().min(1).max(1200),
  lang: z.enum(LANG_IDS).default("hi"),
  model: z.enum(["sarvam/bulbul:v3", "deepgram/aura:2"]).default(DEFAULTS.tts),
  voice: z.string().min(1).max(40).default(DEFAULTS.voice),
});

export async function POST(req: NextRequest) {
  if (!hasSlng()) return jsonResponse({ error: "SLNG_API_KEY is not set" }, 503);
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return jsonResponse({ error: "Invalid request" }, 400);
  const { text, lang, model, voice } = parsed.data;
  try {
    const r = await synthesize(text, lang, model, voice);
    return new Response(new Uint8Array(r.wav), {
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": String(r.wav.length),
        "Cache-Control": "no-store",
        "X-Tts-Ms": String(r.ms),
        "X-Tts-First-Audio-Ms": String(r.firstAudioMs),
        "X-Tts-Model": r.model,
        "X-Tts-Audio-Seconds": String(Math.round(((r.wav.length - 44) / (r.sampleRate * 2)) * 100) / 100),
      },
    });
  } catch (e) {
    const status = e instanceof SlngError ? e.status : 502;
    return jsonResponse({ error: e instanceof Error ? e.message : "TTS failed" }, status);
  }
}
