"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { emptyProfile, type ProfileKey } from "@/lib/profile/fields";
import { DEFAULTS, DEFAULT_REPLY_LANG, type Lang, type ReplyLang } from "@/lib/models";
import { matchSchemes } from "@/lib/schemes/match";
import { greeting } from "@/lib/dialogue";
import { describeMicError, micUnavailableReason, playWav, startRecording, stopPlayback, type Recorder } from "./audio";
import { fetchBanner, isAbortError } from "./fetch-error";
import type { SessionState, Settings, Status, TurnMetrics, TurnResponse, Utterance } from "./types";

const uid = () => Math.random().toString(36).slice(2, 10);

// /api/stt rejects anything over 60 s of 16 kHz PCM. Stop a little early so
// the last ScriptProcessor buffer never tips the upload past the limit.
export const MAX_RECORD_SECONDS = 60;
const AUTO_STOP_AT_SECONDS = 59.5;

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
  const [settings, setSettings] = useState<Settings>({ stt: DEFAULTS.stt, tts: DEFAULTS.tts, voice: DEFAULTS.voice, replyLang: DEFAULT_REPLY_LANG, useLlm: true, speak: true });
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<{ slng: boolean; liveCall: boolean } | null>(null);
  const [micLevel, setMicLevel] = useState(0);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const recorderRef = useRef<Recorder | null>(null);
  const levelTimer = useRef<number | null>(null);
  const stopMicRef = useRef<() => Promise<void>>(async () => {});
  const startingRef = useRef(false);
  const releasedWhileStartingRef = useRef(false);
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

  // Health is informational only (badge, voice playback); nothing the user can
  // click waits for it. Bounded so a hung request can never leave "checking".
  // A timeout or strict-mode abort must not raise the banner: some browsers
  // report that abort as TypeError "Failed to fetch" rather than AbortError.
  useEffect(() => {
    const ctrl = new AbortController();
    let stop: "timeout" | "unmount" | null = null;
    const timer = window.setTimeout(() => { stop = "timeout"; ctrl.abort(); }, 6000);
    fetch("/api/health", { cache: "no-store", signal: ctrl.signal })
      .then((r) => r.json())
      .then((h: { slng?: boolean; liveCall?: boolean }) => setHealth({ slng: Boolean(h.slng), liveCall: Boolean(h.liveCall) }))
      .catch((e) => {
        if (stop === "unmount") return;
        setHealth({ slng: false, liveCall: false });
        if (stop === "timeout" || isAbortError(e)) return;
        const msg = fetchBanner("Health check", e, "Health check failed");
        if (msg) setError(msg);
      })
      .finally(() => window.clearTimeout(timer));
    return () => { stop = "unmount"; window.clearTimeout(timer); ctrl.abort(); };
  }, []);

  // Surface anything that escapes a handler or promise in the banner rather
  // than letting it die silently in the console. Aborts are the timeout above
  // or a superseded request, not a broken page.
  useEffect(() => {
    const describe = (e: unknown) => (e instanceof Error ? e.message : typeof e === "string" ? e : "Unexpected client error");
    const onError = (ev: ErrorEvent) => {
      if (isAbortError(ev.error)) return;
      setError(`Something broke in the page: ${describe(ev.error ?? ev.message)}`);
    };
    const onRejection = (ev: PromiseRejectionEvent) => {
      if (isAbortError(ev.reason)) return;
      setError(`Something broke in the page: ${describe(ev.reason)}`);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  const match = useMemo(() => state.match ?? matchSchemes(state.profile), [state.match, state.profile]);

  const push = useCallback((u: Omit<Utterance, "id">) => {
    setState((s) => ({ ...s, transcript: [...s.transcript, { ...u, id: uid() }] }));
  }, []);

  const speak = useCallback(
    async (text: string, lang: Lang, metrics: TurnMetrics, what: "Greeting" | "Voice reply" = "Voice reply") => {
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
        const msg = fetchBanner(what, e, "Voice playback failed");
        if (msg) setError(msg);
      } finally {
        setStatus("idle");
      }
    },
    [settings.speak, settings.tts, settings.voice, health?.slng],
  );

  // `opts.lang` is the language the text itself is in (demo chips know theirs).
  // When the reply language is "auto" it decides the reply; an explicit
  // setting always wins.
  const sendText = useCallback(
    async (text: string, via: "voice" | "text", metrics?: TurnMetrics, opts?: { lang?: Lang }) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const m: TurnMetrics = metrics ?? { id: uid(), at: Date.now(), totalMs: 0 };
      setError(null);
      push({ role: "citizen", text: trimmed, via, lang: opts?.lang });
      setStatus("thinking");
      const s = stateRef.current;
      const sessionId = getSessionId();
      const replyLang: ReplyLang = settings.replyLang === "auto" && opts?.lang ? opts.lang : settings.replyLang;
      try {
        const t0 = performance.now();
        const res = await fetch("/api/turn", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: trimmed, profile: s.profile, stage: s.stage, pendingField: s.pendingField, replyLang, sessionId, useLlm: settings.useLlm }),
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
            ...prev.transcript.map((u, i) => (i === prev.transcript.length - 1 && u.role === "citizen" ? { ...u, fields: changed, lang: data.detectedLang ?? data.lang } : u)),
            { id: uid(), role: "janvaani", text: data.reply, lang: data.lang },
          ],
        }));
        setStatus("idle");
        await speak(data.reply, data.lang, m);
      } catch (e) {
        const msg = fetchBanner("Turn", e, "Something went wrong");
        if (msg) setError(msg);
        setStatus("idle");
      }
    },
    [push, getSessionId, settings.replyLang, settings.useLlm, speak],
  );

  const startMic = useCallback(async () => {
    if (status !== "idle" || recorderRef.current || startingRef.current) return;
    stopPlayback();
    setError(null);
    const unavailable = micUnavailableReason();
    if (unavailable) { setError(unavailable); return; }
    if (health && !health.slng) { setError("Voice needs SLNG_API_KEY on the server. You can still type below."); return; }
    startingRef.current = true;
    releasedWhileStartingRef.current = false;
    try {
      const rec = await startRecording();
      startingRef.current = false;
      // The button was released while the permission prompt / device was
      // still opening: there is nothing worth sending, drop it quietly.
      if (releasedWhileStartingRef.current) { void rec.stop(); return; }
      recorderRef.current = rec;
      const startedAt = performance.now();
      setRecordSeconds(0);
      setStatus("recording");
      levelTimer.current = window.setInterval(() => {
        setMicLevel(recorderRef.current?.level() ?? 0);
        const secs = (performance.now() - startedAt) / 1000;
        setRecordSeconds(secs);
        if (secs >= AUTO_STOP_AT_SECONDS) void stopMicRef.current();
      }, 80);
    } catch (e) {
      startingRef.current = false;
      setError(describeMicError(e));
    }
  }, [status, health]);

  const stopMic = useCallback(async () => {
    const rec = recorderRef.current;
    if (!rec) { if (startingRef.current) releasedWhileStartingRef.current = true; return; }
    recorderRef.current = null;
    if (levelTimer.current) { clearInterval(levelTimer.current); levelTimer.current = null; }
    setMicLevel(0);
    setRecordSeconds(0);
    setStatus("transcribing");
    const m: TurnMetrics = { id: uid(), at: Date.now(), totalMs: 0 };
    try {
      const { pcm16k, seconds } = await rec.stop();
      m.audioSeconds = Math.round(seconds * 10) / 10;
      const t0 = performance.now();
      // No language hint: Saaras auto-detects, and pinning the reply language
      // must not force a Kannada speaker's audio through Hindi recognition.
      const url = `/api/stt?model=${encodeURIComponent(settings.stt)}`;
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
      const msg = fetchBanner("Speech recognition", e, "Recording failed");
      if (msg) setError(msg);
      setStatus("idle");
    }
  }, [sendText, settings.stt]);
  useEffect(() => { stopMicRef.current = stopMic; }, [stopMic]);

  const reset = useCallback(() => {
    stopPlayback();
    sessionIdRef.current = "";
    setState(initialState());
    setError(null);
    setStatus("idle");
  }, []);

  const playGreeting = useCallback(async () => {
    // "auto" before anyone has spoken: fall back to the session's current
    // language, which starts as Hindi and tracks the citizen afterwards.
    const lang: Lang = settings.replyLang === "auto" ? stateRef.current.lang : settings.replyLang;
    const text = greeting(lang);
    push({ role: "janvaani", text, lang, via: "system" });
    const m: TurnMetrics = { id: uid(), at: Date.now(), totalMs: 0 };
    setState((s) => ({ ...s, lang, metrics: [...s.metrics, m] }));
    await speak(text, lang, m, "Greeting");
  }, [push, settings.replyLang, speak]);

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

  return { state, match, settings, setSettings, status, error, setError, health, micLevel, recordSeconds, startMic, stopMic, sendText, reset, playGreeting, setField, exportSession };
}

export type JanVaani = ReturnType<typeof useJanVaani>;
