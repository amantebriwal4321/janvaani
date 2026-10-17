import type { CitizenProfile, FieldEvidence, ProfileKey } from "@/lib/profile/fields";
import type { Lang, ReplyLang, SttModelId, TtsModelId } from "@/lib/models";
import type { Stage } from "@/lib/dialogue";
import type { MatchSummary } from "@/lib/schemes/match";

export type Utterance = {
  id: string;
  role: "citizen" | "janvaani";
  text: string;
  lang?: Lang;
  via?: "voice" | "text" | "system";
  fields?: ProfileKey[];
};

export type TurnMetrics = {
  id: string;
  at: number;
  sttMs?: number;
  sttModel?: string;
  audioSeconds?: number;
  llmMs?: number;
  llmModel?: string;
  llmSource?: string;
  ttsMs?: number;
  ttsFirstAudioMs?: number;
  ttsModel?: string;
  totalMs: number;
};

export type Status = "idle" | "recording" | "transcribing" | "thinking" | "speaking";

export type Settings = {
  stt: SttModelId;
  tts: TtsModelId;
  voice: string;
  // Language JanVaani replies and speaks in; "auto" follows the citizen.
  replyLang: ReplyLang;
  useLlm: boolean;
  speak: boolean;
};

export type SessionState = {
  sessionId: string;
  profile: CitizenProfile;
  stage: Stage;
  pendingField: ProfileKey | null;
  lang: Lang;
  transcript: Utterance[];
  evidence: FieldEvidence[];
  match: MatchSummary | null;
  metrics: TurnMetrics[];
  recentFields: ProfileKey[];
};

export type TurnResponse = {
  profile: CitizenProfile;
  delta: Partial<CitizenProfile>;
  evidence: FieldEvidence[];
  match: MatchSummary;
  stage: Stage;
  pendingField: ProfileKey | null;
  reply: string;
  lang: Lang;
  detectedLang: Lang;
  llm: { used: boolean; ms: number; model: string; source: string; fallback?: string } | null;
  newlyEligible: string[];
  serverMs: number;
};
