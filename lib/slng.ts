import "server-only";
import WebSocket from "ws";
import { env, slngHosts } from "./env";
import type { Lang, SttModelId, TtsModelId } from "./models";
import { LANGS } from "./models";

const auth = () => ({ Authorization: `Bearer ${env.slngApiKey}` });

export class SlngError extends Error {
  constructor(message: string, public status = 502, public requestId?: string) {
    super(message);
  }
}

// ---------- STT ----------

export type SttResult = { transcript: string; ms: number; model: SttModelId; requestId?: string };

export async function transcribe(pcm16k: Buffer, model: SttModelId, langHint?: Lang): Promise<SttResult> {
  const t0 = Date.now();
  if (model === "slng/deepgram/nova:3-hi") {
    const wav = pcmToWav(pcm16k, 16000);
    const form = new FormData();
    form.append("audio", new Blob([new Uint8Array(wav)], { type: "audio/wav" }), "audio.wav");
    const res = await fetch(`${slngHosts().api}/v1/stt/${model}?smart_format=true`, { method: "POST", headers: auth(), body: form });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new SlngError(json?.message ?? json?.error ?? `STT failed (${res.status})`, res.status, json?.slng_request_id);
    const transcript: string = json?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";
    return { transcript, ms: Date.now() - t0, model, requestId: json?.metadata?.request_id };
  }
  return sttBridge(pcm16k, model, langHint, t0);
}

function sttBridge(pcm16k: Buffer, model: SttModelId, langHint: Lang | undefined, t0: number): Promise<SttResult> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${slngHosts().ws}/v1/bridges/unmute/stt/${model}`, { headers: auth() });
    const finals: string[] = [];
    let partial = "";
    let requestId: string | undefined;
    let settled = false;
    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws.close(); } catch {}
      if (err) reject(err);
      else resolve({ transcript: (finals.join(" ") || partial).trim(), ms: Date.now() - t0, model, requestId });
    };
    const timer = setTimeout(() => finish(finals.length || partial ? undefined : new SlngError("STT timed out", 504, requestId)), 20000);

    ws.on("open", () => {
      const config: Record<string, unknown> = { sample_rate: 16000, channels: 1, encoding: "linear16", enable_partials: true };
      // Saaras accepts "unknown" for auto-detect; Soniox rejects unsupported hints, so only pass a real code there.
      if (model === "sarvam/saaras:v3") config.language = langHint ? LANGS[langHint].bcp47 : "unknown";
      else if (langHint) config.language = langHint;
      ws.send(JSON.stringify({ type: "init", config }));
    });
    ws.on("message", (raw) => {
      let msg: { type?: string; transcript?: string; message?: string; slng_request_id?: string };
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      switch (msg.type) {
        case "ready": {
          requestId = msg.slng_request_id;
          const CH = 8192;
          for (let i = 0; i < pcm16k.length; i += CH) {
            ws.send(JSON.stringify({ type: "audio", data: pcm16k.subarray(i, i + CH).toString("base64") }));
          }
          ws.send(JSON.stringify({ type: "finalize" }));
          ws.send(JSON.stringify({ type: "close" }));
          break;
        }
        case "partial_transcript": partial = msg.transcript ?? partial; break;
        case "final_transcript": if (msg.transcript) finals.push(msg.transcript); break;
        case "error": finish(new SlngError(msg.message ?? "STT provider error", 502, msg.slng_request_id)); break;
      }
    });
    ws.on("close", () => finish());
    ws.on("error", (e) => finish(new SlngError(e.message, 502)));
  });
}

// ---------- TTS ----------

export type TtsResult = { wav: Buffer; ms: number; firstAudioMs: number; model: TtsModelId; sampleRate: number };

export async function synthesize(text: string, lang: Lang, model: TtsModelId, voice: string): Promise<TtsResult> {
  const t0 = Date.now();
  if (model === "deepgram/aura:2") {
    const res = await fetch(`${slngHosts().api}/v1/tts/${model}`, {
      method: "POST",
      headers: { ...auth(), "Content-Type": "application/json" },
      body: JSON.stringify({ text, model: voice.startsWith("aura-") ? voice : "aura-2-thalia-en" }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new SlngError(json?.message ?? `TTS failed (${res.status})`, res.status, json?.slng_request_id);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const ms = Date.now() - t0;
    return { wav: buf, ms, firstAudioMs: ms, model, sampleRate: 24000 };
  }
  return ttsBridge(text, lang, model, voice, t0);
}

function ttsBridge(text: string, lang: Lang, model: TtsModelId, voice: string, t0: number): Promise<TtsResult> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${slngHosts().ws}/v1/bridges/unmute/tts/${model}`, { headers: auth() });
    const chunks: Buffer[] = [];
    let first = 0;
    let settled = false;
    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws.close(); } catch {}
      if (err) return reject(err);
      if (!chunks.length) return reject(new SlngError("TTS returned no audio", 502));
      resolve({ wav: pcmToWav(Buffer.concat(chunks), 24000), ms: Date.now() - t0, firstAudioMs: first, model, sampleRate: 24000 });
    };
    const timer = setTimeout(() => finish(chunks.length ? undefined : new SlngError("TTS timed out", 504)), 25000);

    ws.on("open", () => {
      ws.send(JSON.stringify({ type: "init", voice, config: { sample_rate: 24000, encoding: "linear16", language: LANGS[lang].tts } }));
    });
    ws.on("message", (raw, isBinary) => {
      if (isBinary) {
        if (!first) first = Date.now() - t0;
        chunks.push(Buffer.from(raw as Buffer));
        return;
      }
      let msg: { type?: string; message?: string; data?: { audio?: string } };
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      switch (msg.type) {
        case "ready":
          ws.send(JSON.stringify({ type: "text", text }));
          ws.send(JSON.stringify({ type: "flush" }));
          break;
        case "audio":
          if (msg.data?.audio) { if (!first) first = Date.now() - t0; chunks.push(Buffer.from(msg.data.audio, "base64")); }
          break;
        case "audio_end":
          ws.send(JSON.stringify({ type: "close" }));
          finish();
          break;
        case "error": finish(new SlngError(msg.message ?? "TTS provider error", 502)); break;
      }
    });
    ws.on("close", () => finish());
    ws.on("error", (e) => finish(new SlngError(e.message, 502)));
  });
}

// ---------- LLM via Context Router ----------

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
export type LlmResult = { content: string; ms: number; model: string; source: string; usage?: { prompt_tokens?: number; completion_tokens?: number } };

export async function routerChat(messages: ChatMessage[], sessionId: string, opts?: { json?: boolean; maxTokens?: number; temperature?: number }): Promise<LlmResult> {
  const t0 = Date.now();
  const body: Record<string, unknown> = {
    model: "slng/auto",
    messages,
    temperature: opts?.temperature ?? 0.2,
    max_tokens: opts?.maxTokens ?? 700,
    slng_agent_id: `${env.slngAgentId}-janvaani-v1`,
    slng_session_id: sessionId,
  };
  if (opts?.json) body.response_format = { type: "json_object" };
  if (env.byok.url && env.byok.key && env.byok.model) {
    body.slng_config = {
      tiers: { "1": [{ model: env.byok.model, weight: 100, endpoint: { url: env.byok.url, api_key: env.byok.key } }] },
    };
  }
  const res = await fetch(`${slngHosts().router}/chat/completions`, {
    method: "POST",
    headers: { ...auth(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new SlngError(json?.error?.message ?? `LLM failed (${res.status})`, res.status, res.headers.get("x-slng-request-id") ?? undefined);
  return {
    content: json?.choices?.[0]?.message?.content ?? "",
    ms: Date.now() - t0,
    model: res.headers.get("x-slng-model") ?? json?.model ?? "slng/auto",
    source: res.headers.get("x-slng-response-source") ?? "llm",
    usage: json?.usage,
  };
}

// ---------- Agents (Live Call mode) ----------

export async function createWebSession(participantName?: string) {
  const res = await fetch(`${slngHosts().agents}/v1/agents/${env.slngAgentId}/web-sessions`, {
    method: "POST",
    headers: { ...auth(), "Content-Type": "application/json" },
    body: JSON.stringify({ arguments: {}, ...(participantName ? { participant_name: participantName } : {}) }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new SlngError(json?.message ?? `Web session failed (${res.status})`, res.status);
  return json as { call_id: string; room_name: string; livekit_url: string; livekit_token: string; max_session_seconds: number };
}

// ---------- audio helpers ----------

export function pcmToWav(pcm: Buffer, sampleRate: number, channels = 1): Buffer {
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * channels * 2;
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(channels * 2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}
