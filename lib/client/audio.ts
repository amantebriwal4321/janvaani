"use client";

export type Recorder = {
  stop: () => Promise<{ pcm16k: ArrayBuffer; seconds: number }>;
  level: () => number;
};

// getUserMedia only exists in secure contexts (https, localhost, 127.0.0.1).
// A preview served from a LAN IP or an http proxy has no navigator.mediaDevices
// at all, which would otherwise surface as a cryptic TypeError.
export function micUnavailableReason(): string | null {
  if (typeof window === "undefined") return "Microphone is only available in the browser.";
  if (!window.isSecureContext) return `Mic needs https or localhost (this page is on ${window.location.host}). You can still type below.`;
  if (!navigator.mediaDevices?.getUserMedia) return "This browser does not expose a microphone API. You can still type below.";
  if (typeof AudioContext === "undefined") return "This browser cannot process microphone audio. You can still type below.";
  return null;
}

export function describeMicError(e: unknown): string {
  const name = e instanceof DOMException ? e.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "Microphone permission was denied. Allow the mic in the address bar, or type below.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No microphone was found on this device. You can still type below.";
  if (name === "NotReadableError") return "The microphone is in use by another app. You can still type below.";
  return `Could not start the microphone${e instanceof Error && e.message ? ` (${e.message})` : ""}. You can still type below.`;
}

// Captures mic audio, downsamples to 16 kHz mono PCM16 on the client so the
// server can forward it to SLNG STT without transcoding.
export async function startRecording(): Promise<Recorder> {
  const unavailable = micUnavailableReason();
  if (unavailable) throw new Error(unavailable);
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  const processor = ctx.createScriptProcessor(4096, 1, 1);
  const chunks: Float32Array[] = [];
  const inRate = ctx.sampleRate;

  processor.onaudioprocess = (e) => {
    chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
  };
  source.connect(analyser);
  analyser.connect(processor);
  processor.connect(ctx.destination);

  const levelBuf = new Uint8Array(analyser.frequencyBinCount);

  return {
    level: () => {
      analyser.getByteTimeDomainData(levelBuf);
      let sum = 0;
      for (let i = 0; i < levelBuf.length; i++) { const v = (levelBuf[i] - 128) / 128; sum += v * v; }
      return Math.min(1, Math.sqrt(sum / levelBuf.length) * 4);
    },
    stop: async () => {
      processor.disconnect();
      analyser.disconnect();
      source.disconnect();
      stream.getTracks().forEach((t) => t.stop());
      await ctx.close();
      const total = chunks.reduce((n, c) => n + c.length, 0);
      const merged = new Float32Array(total);
      let o = 0;
      for (const c of chunks) { merged.set(c, o); o += c.length; }
      const pcm = downsampleTo16k(merged, inRate);
      return { pcm16k: pcm.buffer as ArrayBuffer, seconds: pcm.length / 16000 };
    },
  };
}

function downsampleTo16k(input: Float32Array, inRate: number): Int16Array {
  const ratio = inRate / 16000;
  const outLen = Math.floor(input.length / ratio);
  const out = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let acc = 0;
    let n = 0;
    for (let j = start; j < end; j++) { acc += input[j]; n++; }
    const s = n ? acc / n : 0;
    out[i] = Math.max(-32768, Math.min(32767, Math.round(s * 32767)));
  }
  return out;
}

let currentAudio: HTMLAudioElement | null = null;

export function playWav(blob: Blob): Promise<void> {
  stopPlayback();
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const a = new Audio(url);
    currentAudio = a;
    a.onended = () => { URL.revokeObjectURL(url); if (currentAudio === a) currentAudio = null; resolve(); };
    a.onerror = () => { URL.revokeObjectURL(url); resolve(); };
    a.play().catch(() => resolve());
  });
}

export function stopPlayback() {
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
}
