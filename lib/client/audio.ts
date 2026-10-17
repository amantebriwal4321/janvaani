"use client";

export type Recorder = {
  stop: () => Promise<{ pcm16k: ArrayBuffer; seconds: number }>;
  level: () => number;
};

// Captures mic audio, downsamples to 16 kHz mono PCM16 on the client so the
// server can forward it to SLNG STT without transcoding.
export async function startRecording(): Promise<Recorder> {
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
