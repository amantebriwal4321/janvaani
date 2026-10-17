export type Lang = "hi" | "kn" | "te" | "ta" | "mr" | "en";

export const LANGS: Record<Lang, { label: string; native: string; bcp47: string }> = {
  hi: { label: "Hindi", native: "हिन्दी", bcp47: "hi-IN" },
  kn: { label: "Kannada", native: "ಕನ್ನಡ", bcp47: "kn-IN" },
  te: { label: "Telugu", native: "తెలుగు", bcp47: "te-IN" },
  ta: { label: "Tamil", native: "தமிழ்", bcp47: "ta-IN" },
  mr: { label: "Marathi", native: "मराठी", bcp47: "mr-IN" },
  en: { label: "English", native: "English", bcp47: "en-IN" },
};

export type SttModelId = "sarvam/saaras:v3" | "slng/deepgram/nova:3-hi" | "soniox/speech-ai:rt-v5";
export type TtsModelId = "sarvam/bulbul:v3" | "deepgram/aura:2";

export const STT_MODELS: { id: SttModelId; label: string; transport: "ws-bridge" | "http"; langs: string; note: string }[] = [
  { id: "sarvam/saaras:v3", label: "Sarvam Saaras v3", transport: "ws-bridge", langs: "23 Indian languages, code-mixed", note: "Auto-detects language. Primary." },
  { id: "slng/deepgram/nova:3-hi", label: "Deepgram Nova 3 Hindi", transport: "http", langs: "Hindi + English", note: "HTTP, fast comparison." },
  { id: "soniox/speech-ai:rt-v5", label: "Soniox Speech AI v5", transport: "ws-bridge", langs: "60+ languages", note: "Alternate multilingual." },
];

export const TTS_MODELS: { id: TtsModelId; label: string; transport: "ws-bridge" | "http"; langs: string; note: string }[] = [
  { id: "sarvam/bulbul:v3", label: "Sarvam Bulbul v3", transport: "ws-bridge", langs: "hi, kn, te, ta, mr, bn, gu, ml, od, pa, en-IN", note: "Indian voices. Primary." },
  { id: "deepgram/aura:2", label: "Deepgram Aura 2", transport: "http", langs: "English only", note: "Low-latency English comparison." },
];

export const DEFAULTS = { stt: "sarvam/saaras:v3" as SttModelId, tts: "sarvam/bulbul:v3" as TtsModelId, voice: "shubh" };

export const BULBUL_VOICES = ["shubh", "aditya", "ritu", "priya", "neha", "rahul", "pooja", "kavya", "amit", "dev"] as const;

// SLNG's published rate shown in the dashboard for this project (per agent minute).
export const SLNG_RATE_PER_MIN_USD = 0.013;
