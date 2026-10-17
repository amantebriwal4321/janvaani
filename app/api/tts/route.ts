import { NextRequest } from "next/server";
import { z } from "zod";
import { hasSlng } from "@/lib/env";
import { SlngError, synthesize } from "@/lib/slng";
import { DEFAULTS } from "@/lib/models";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  text: z.string().min(1).max(1200),
  lang: z.enum(["hi", "kn", "te", "ta", "mr", "en"]).default("hi"),
  model: z.enum(["sarvam/bulbul:v3", "deepgram/aura:2"]).default(DEFAULTS.tts),
  voice: z.string().min(1).max(40).default(DEFAULTS.voice),
});

export async function POST(req: NextRequest) {
  if (!hasSlng()) return Response.json({ error: "SLNG_API_KEY is not set" }, { status: 503 });
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const { text, lang, model, voice } = parsed.data;
  try {
    const r = await synthesize(text, lang, model, voice);
    return new Response(new Uint8Array(r.wav), {
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "no-store",
        "X-Tts-Ms": String(r.ms),
        "X-Tts-First-Audio-Ms": String(r.firstAudioMs),
        "X-Tts-Model": r.model,
        "X-Tts-Audio-Seconds": String(Math.round(((r.wav.length - 44) / (r.sampleRate * 2)) * 100) / 100),
      },
    });
  } catch (e) {
    const status = e instanceof SlngError ? e.status : 502;
    return Response.json({ error: e instanceof Error ? e.message : "TTS failed" }, { status });
  }
}
