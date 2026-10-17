"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { emptyProfile, type ProfileKey } from "@/lib/profile/schema";
import { DEFAULTS, type Lang } from "@/lib/models";
import { matchSchemes } from "@/lib/schemes/match";
import { greeting } from "@/lib/dialogue";
import { playWav, startRecording, stopPlayback, type Recorder } from "./audio";
import type { SessionState, Settings, Status, TurnMetrics, TurnResponse, Utterance } from "./types";

const uid = () => Math.random().toString(36).slice(2, 10);

// sessionId is filled lazily on the first user action: with cacheComponents the
// client prerender forbids Math.random()/Date.now() during render.
const initialState = (): SessionState => ({
  sessionId: "",
  profile: emptyProfile(),
  stage: "intake",
  pendingField: null,
  lang: "hi",
  transcript: [],
  evidence: [],
  match: null,
  metrics: [],
  recentFields: [],
});

export function useJanVaani() {
  const [state, setState] = useState<SessionState>(initialState);
  const [settings, setSettings] = useState<Settings>({ stt: DEFAULTS.stt, tts: DEFAULTS.tts, voice: DEFAULTS.voice, lang: "auto", useLlm: true, speak: true });
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<{ slng: boolean; liveCall: boolean } | null>(null);
  const [micLevel, setMicLevel] = useState(0);
  const recorderRef = useRef<Recorder | null>(null);
  const levelTimer = useRef<number | null>(null);
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);
  const reactId = useId();
  const sessionIdRef = useRef<string>("");
  const getSessionId = useCallback(() => {
    if (!sessionIdRef.current) {
      const id = `jv-${reactId.replace(/[^a-zA-Z0-9]/g, "")}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      sessionIdRef.current = id;
      setState((s) => (s.sessionId ? s : { ...s, sessionId: id }));
    }
    return sessionIdRef.current;
  }, [reactId]);

  useEffect(() => {
    fetch("/api/health").then((r) => r.json()).then(setHealth).catch(() => setHealth({ slng: false, liveCall: false }));
  }, []);

  const match = useMemo(() => state.match ?? matchSchemes(state.profile), [state.match, state.profile]);

  const push = useCallback((u: Omit<Utterance, "id">) => {
    setState((s) => ({ ...s, transcript: [...s.transcript, { ...u, id: uid() }] }));
  }, []);

  const speak = useCallback(
    async (text: string, lang: Lang, metrics: TurnMetrics) => {
      if (!settings.speak || !health?.slng) return;
      setStatus("speaking");
      try {
        const t0 = performance.now();
        const res = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, lang, model: settings.tts, voice: settings.voice }) });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ?? "Voice playback failed");
        }
        metrics.ttsMs = Number(res.headers.get("X-Tts-Ms") ?? Math.round(performance.now() - t0));
        metrics.ttsFirstAudioMs = Number(res.headers.get("X-Tts-First-Audio-Ms") ?? metrics.ttsMs);
        metrics.ttsModel = res.headers.get("X-Tts-Model") ?? settings.tts;
        metrics.totalMs += metrics.ttsMs;
        setState((s) => ({ ...s, metrics: s.metrics.map((m) => (m.id === metrics.id ? { ...metrics } : m)) }));
        await playWav(await res.blob());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Voice playback failed");
      } finally {
        setStatus("idle");
      }
    },
    [settings.speak, settings.tts, settings.voice, health?.slng],
  );

  const sendText = useCallback(
    async (text: string, via: "voice" | "text", metrics?: TurnMetrics) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const m: TurnMetrics = metrics ?? { id: uid(), at: Date.now(), totalMs: 0 };
      setError(null);
      push({ role: "citizen", text: trimmed, via });
      setStatus("thinking");
      const s = stateRef.current;
      const sessionId = getSessionId();
      try {
        const t0 = performance.now();
        const res = await fetch("/api/turn", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: trimmed, profile: s.profile, stage: s.stage, pendingField: s.pendingField, lang: settings.lang, sessionId, useLlm: settings.useLlm }),
        });
        const data = (await res.json()) as TurnResponse & { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Could not process that");
        m.llmMs = data.llm?.used ? data.llm.ms : 0;
        m.llmModel = data.llm?.used ? data.llm.model : "rules only";
        m.llmSource = data.llm?.source ?? "rules";
        m.totalMs += Math.round(performance.now() - t0);
        if (data.llm && !data.llm.used && data.llm.fallback && settings.useLlm) setError(`LLM unavailable, used rule engine: ${data.llm.fallback}`);
        const changed = Object.keys(data.delta) as ProfileKey[];
        setState((prev) => ({
          ...prev,
          profile: data.profile,
          stage: data.stage,
          pendingField: data.pendingField,
          lang: data.lang,
          match: data.match,
          evidence: [...prev.evidence.filter((e) => !changed.includes(e.field)), ...data.evidence],
          recentFields: changed,
          metrics: metrics ? prev.metrics.map((x) => (x.id === m.id ? { ...m } : x)) : [...prev.metrics, { ...m }],
          transcript: [
            ...prev.transcript.map((u, i) => (i === prev.transcript.length - 1 && u.role === "citizen" ? { ...u, fields: changed, lang: data.lang } : u)),
            { id: uid(), role: "janvaani", text: data.reply, lang: data.lang },
          ],
        }));
        setStatus("idle");
        await speak(data.reply, data.lang, m);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
        setStatus("idle");
      }
    },
    [push, getSessionId, settings.lang, settings.useLlm, speak],
  );

  const startMic = useCallback(async () => {
    if (status !== "idle") return;
    stopPlayback();
    setError(null);
    try {
      recorderRef.current = await startRecording();
      setStatus("recording");
      levelTimer.current = window.setInterval(() => setMicLevel(recorderRef.current?.level() ?? 0), 80);
    } catch {
      setError("Microphone permission was denied. You can still type below.");
    }
  }, [status]);

  const stopMic = useCallback(async () => {
    const rec = recorderRef.current;
    if (!rec) return;
    recorderRef.current = null;
    if (levelTimer.current) { clearInterval(levelTimer.current); levelTimer.current = null; }
    setMicLevel(0);
    setStatus("transcribing");
    const m: TurnMetrics = { id: uid(), at: Date.now(), totalMs: 0 };
    try {
      const { pcm16k, seconds } = await rec.stop();
      m.audioSeconds = Math.round(seconds * 10) / 10;
      const t0 = performance.now();
      const url = `/api/stt?model=${encodeURIComponent(settings.stt)}${settings.lang !== "auto" ? `&lang=${settings.lang}` : ""}`;
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: pcm16k });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not hear that");
      m.sttMs = data.ms ?? Math.round(performance.now() - t0);
      m.sttModel = data.model;
      m.totalMs += m.sttMs ?? 0;
      setState((s) => ({ ...s, metrics: [...s.metrics, { ...m }] }));
      if (!data.transcript) {
        setError("Heard silence. Hold the button and speak clearly, then release.");
        setStatus("idle");
        return;
      }
      await sendText(data.transcript, "voice", m);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Recording failed");
      setStatus("idle");
    }
  }, [sendText, settings.stt, settings.lang]);

  const reset = useCallback(() => {
    stopPlayback();
    sessionIdRef.current = "";
    setState(initialState());
    setError(null);
    setStatus("idle");
  }, []);

  const playGreeting = useCallback(async () => {
    const lang: Lang = settings.lang === "auto" ? "hi" : settings.lang;
    const text = greeting(lang);
    push({ role: "janvaani", text, lang, via: "system" });
    const m: TurnMetrics = { id: uid(), at: Date.now(), totalMs: 0 };
    setState((s) => ({ ...s, lang, metrics: [...s.metrics, m] }));
    await speak(text, lang, m);
  }, [push, settings.lang, speak]);

  const setField = useCallback((field: ProfileKey, value: unknown) => {
    setState((s) => {
      const profile = { ...s.profile, [field]: value };
      return { ...s, profile, match: matchSchemes(profile), recentFields: [field], evidence: [...s.evidence.filter((e) => e.field !== field), { field, quote: "edited by hand", origin: "typed", confidence: 1 }] };
    });
  }, []);

  const exportSession = useCallback(() => {
    const sessionId = getSessionId();
    const blob = new Blob([JSON.stringify({ ...stateRef.current, sessionId, settings, exportedAt: new Date().toISOString() }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `janvaani-${sessionId}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [getSessionId, settings]);

  return { state, match, settings, setSettings, status, error, setError, health, micLevel, startMic, stopMic, sendText, reset, playGreeting, setField, exportSession };
}

export type JanVaani = ReturnType<typeof useJanVaani>;
