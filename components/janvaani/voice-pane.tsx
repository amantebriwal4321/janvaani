"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Send, Square, Loader2, Volume2, Sparkles, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { FIELD_LABELS } from "@/lib/profile/fields";
import { LANG_IDS, LANGS, type Lang, type ReplyLang } from "@/lib/models";
import { cn } from "@/lib/utils";
import { MAX_RECORD_SECONDS, type JanVaani } from "@/lib/client/use-janvaani";

// Each chip carries the language it is written in. With the reply language on
// "auto" that decides the answer; an explicit reply language always wins.
const DEMOS: { label: string; text: string; lang: Lang }[] = [
  { label: "Kolar farmer", lang: "hi", text: "Main Kolar ke paas ek gaon se hoon, 2 acre mein tamatar ugata hoon, umar 45 saal hai. Is baar baarish se fasal kharab ho gayi. Ghar mein BPL card hai aur pitaji 72 saal ke hain." },
  { label: "Widow, domestic work", lang: "hi", text: "Mera naam Lakshmi, 52 saal, Mandya mein rehti hoon. Pati nahi rahe. Ghar ka kaam karti hoon do gharon mein. Ration card mein mera naam mukhiya hai. Ghar kachcha hai." },
  { label: "ಟೈಲರ್ (Kannada)", lang: "kn", text: "ನಾನು ತುಮಕೂರಿನವನು, ವಯಸ್ಸು ೩೮. ಟೈಲರ್ ಕೆಲಸ ಮಾಡುತ್ತೇನೆ, ಸ್ವಂತ ಅಂಗಡಿ ಇಲ್ಲ. ಬಿಪಿಎಲ್ ಕಾರ್ಡ್ ಇದೆ." },
  { label: "Auto driver, Bengaluru", lang: "en", text: "I drive an auto in Bangalore city, I am 34, no PF, no land. We have an APL ration card. My mother is 71 and lives with us." },
  { label: "ਕਿਸਾਨ (Punjabi)", lang: "pa", text: "ਮੈਂ ਲੁਧਿਆਣਾ ਤੋਂ ਹਾਂ, 3 acre ਜ਼ਮੀਨ, umar 50 saal. ਇਸ ਵਾਰ ਫ਼ਸਲ ਖਰਾਬ ਹੋ ਗਈ।" },
  { label: "भोजपुरी", lang: "bho", text: "हम कोलार से बानी, 3 acre जमीन बा, उमिर 45 साल बा। ई बेर फसल खराब भइल बा।" },
  { label: "অসমীয়া", lang: "as", text: "মই কৃষক, তিনি একৰ মাটি, age 45। এইবাৰ শস্য নষ্ট হৈছে।" },
];

export function VoicePane({ jv }: { jv: JanVaani }) {
  const { state, status, micLevel, recordSeconds, startMic, stopMic, sendText, health, playGreeting, settings, setSettings } = jv;
  const [draft, setDraft] = useState("");
  // true = tap-to-toggle recording (a tap stops it); false = hold-to-talk.
  const [latched, setLatched] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recording = status === "recording";
  const busy = status !== "idle" && status !== "recording";

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [state.transcript.length, status]);

  const submit = () => {
    if (!draft.trim() || busy) return;
    sendText(draft, "text");
    setDraft("");
  };

  const replyLabel = settings.replyLang === "auto" ? `Auto (${LANGS[state.lang].native})` : LANGS[settings.replyLang].native;
  const demo = (d: (typeof DEMOS)[number]) => sendText(d.text, "text", undefined, { lang: d.lang });

  return (
    <section className="flex h-full min-h-0 flex-col rounded-2xl border bg-card shadow-sm">
      <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Conversation</h2>
          <p className="truncate text-xs text-muted-foreground">Hold or tap the mic, or type below</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Select value={settings.replyLang} onValueChange={(v) => v && setSettings((s) => ({ ...s, replyLang: v as ReplyLang }))}>
            <SelectTrigger size="sm" aria-label="Reply language" title="Reply language" data-testid="reply-lang" className="gap-1 rounded-full bg-background px-2 text-xs">
              <Languages className="size-3.5 text-muted-foreground" />
              <span>{replyLabel}</span>
            </SelectTrigger>
            <SelectContent align="end" alignItemWithTrigger={false}>
              {LANG_IDS.map((l) => <SelectItem key={l} value={l}>{LANGS[l].native} <span className="text-muted-foreground">{LANGS[l].label}</span></SelectItem>)}
              <SelectItem value="auto">Auto <span className="text-muted-foreground">match the citizen</span></SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="outline" className="hidden gap-1 font-normal sm:inline-flex">
            <span className={cn("size-1.5 rounded-full", health?.slng ? "bg-emerald-500" : "bg-amber-500")} />
            {health == null ? "checking" : health.slng ? "SLNG India connected" : "Text-only mode"}
          </Badge>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 min-h-0 space-y-3 overflow-y-auto px-4 py-4">
        {state.transcript.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div className="rounded-full bg-primary/10 p-4 text-primary">
              <Sparkles className="size-6" />
            </div>
            <div className="max-w-sm space-y-1">
              <p className="text-base font-medium">Tell JanVaani your story</p>
              <p className="text-sm text-muted-foreground">
                Say where you live, what work you do, and your age, in your own words. The form on the right fills itself and the schemes you qualify for appear as you talk.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={playGreeting} disabled={busy}>
              <Volume2 data-icon="inline-start" /> Hear the greeting
            </Button>
            <div className="flex flex-wrap justify-center gap-1.5 pt-2">
              {DEMOS.map((d) => (
                <button key={d.label} onClick={() => demo(d)} disabled={busy} className="rounded-full border bg-background px-3 py-1 text-xs hover:bg-muted disabled:opacity-50">
                  Try: {d.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {state.transcript.map((u) => (
          <div key={u.id} className={cn("flex", u.role === "citizen" ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[15px] leading-relaxed", u.role === "citizen" ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-muted")}>
              <p>{u.text}</p>
              <div className={cn("mt-1.5 flex flex-wrap items-center gap-1 text-[10px] uppercase tracking-wide", u.role === "citizen" ? "text-primary-foreground/70" : "text-muted-foreground")}>
                {u.lang && <span>{LANGS[u.lang].label}</span>}
                {u.via === "voice" && <span>- voice</span>}
                {u.via === "live" && <span>- live call</span>}
                {u.fields && u.fields.length > 0 && (
                  <span className="flex flex-wrap gap-1 normal-case tracking-normal">
                    {u.fields.slice(0, 6).map((f) => (
                      <span key={f} className={cn("rounded px-1.5 py-px", u.role === "citizen" ? "bg-primary-foreground/20" : "bg-background")}>
                        {FIELD_LABELS[f].label}
                      </span>
                    ))}
                    {u.fields.length > 6 && <span>+{u.fields.length - 6}</span>}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-muted px-3.5 py-2.5 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {status === "transcribing" ? "Listening to what you said..." : status === "thinking" ? "Filling the form..." : "Speaking..."}
            </div>
          </div>
        )}
      </div>

      <footer className="border-t p-3">
        <div className="flex items-end gap-2">
          <PushToTalk status={status} level={micLevel} disabled={busy} dimmed={health != null && !health.slng} latched={latched} onLatch={setLatched} onStart={startMic} onStop={stopMic} />
          {recording ? (
            <RecordingStatus seconds={recordSeconds} latched={latched} />
          ) : (
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
              placeholder={health?.slng ? "Or type here, e.g. Main Kolar se hoon, 2 acre kheti, umar 45" : "Type here, e.g. Main Kolar se hoon, 2 acre kheti, umar 45"}
              className="min-h-11 max-h-32 flex-1 resize-none text-[15px]"
              rows={1}
              disabled={busy}
            />
          )}
          <Button size="icon" className="size-11 shrink-0" onClick={submit} disabled={!draft.trim() || busy || recording} aria-label="Send">
            <Send />
          </Button>
        </div>
        {state.transcript.length > 0 && state.stage !== "done" && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {DEMOS.slice(0, 2).map((d) => (
              <button key={d.label} onClick={() => demo(d)} disabled={busy} className="rounded-full border px-2.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted disabled:opacity-50">
                {d.label}
              </button>
            ))}
          </div>
        )}
      </footer>
    </section>
  );
}

function RecordingStatus({ seconds, latched }: { seconds: number; latched: boolean }) {
  const remaining = Math.max(0, Math.ceil(MAX_RECORD_SECONDS - seconds));
  const nearCap = remaining <= 10;
  const whole = Math.floor(seconds);
  const clock = `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="recording-status"
      className={cn("flex min-h-11 flex-1 items-center justify-between gap-2 rounded-lg border px-3 text-sm", nearCap ? "border-amber-300 bg-amber-50 text-amber-900" : "border-red-200 bg-red-50 text-red-900")}
    >
      <span className="flex items-center gap-2">
        <span className="size-2 animate-pulse rounded-full bg-red-500" />
        <span>Recording… <span className="text-muted-foreground">{latched ? "tap to stop" : "release to send"}</span></span>
      </span>
      <span className="tabular-nums text-xs">
        {clock}
        {nearCap && <span className="ml-1.5 font-medium">{remaining}s left</span>}
      </span>
    </div>
  );
}

// A press shorter than this is a tap: recording keeps going until the next tap.
const TAP_MS = 300;

// Never disabled while idle: pressing it with no SLNG key or in an insecure
// context produces an explanatory banner instead of a silent dead button.
//
// Hold-to-talk and tap-to-toggle share one button. The pointer is captured on
// press so the release is seen even when the finger drifts off the button, and
// pointerleave is deliberately ignored: it used to end the recording on the
// slightest movement, which is what "I can't hold the mic for long" was.
function PushToTalk({ status, level, disabled, dimmed, latched, onLatch, onStart, onStop }: {
  status: string;
  level: number;
  disabled: boolean;
  dimmed: boolean;
  latched: boolean;
  onLatch: (v: boolean) => void;
  onStart: () => void;
  onStop: () => void;
}) {
  const recording = status === "recording";
  const pressedAt = useRef<number | null>(null);
  const swallowRelease = useRef(false);

  const press = () => {
    if (recording) {
      // Second press while recording (latched, or a stray extra pointer): stop.
      swallowRelease.current = true;
      pressedAt.current = null;
      onLatch(false);
      onStop();
      return;
    }
    pressedAt.current = performance.now();
    onLatch(false);
    onStart();
  };

  const release = () => {
    if (swallowRelease.current) { swallowRelease.current = false; return; }
    if (pressedAt.current == null) return;
    const held = performance.now() - pressedAt.current;
    pressedAt.current = null;
    if (held < TAP_MS) { onLatch(true); return; }
    onLatch(false);
    onStop();
  };

  // The browser took the pointer away (gesture, rotation, tab switch). Keep the
  // recording and hand it to tap-to-stop instead of cutting the citizen off.
  const cancel = () => {
    if (pressedAt.current == null) return;
    pressedAt.current = null;
    onLatch(true);
  };

  const hint = recording ? (latched ? "Recording. Tap to stop" : "Recording. Release to send") : "Hold to speak, or tap to start";

  return (
    <button
      type="button"
      disabled={disabled && !recording}
      data-testid="ptt"
      data-recording={recording ? (latched ? "latched" : "hold") : "off"}
      onPointerDown={(e) => {
        if (e.button !== 0 && e.pointerType === "mouse") return;
        e.preventDefault();
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
        press();
      }}
      onPointerUp={(e) => { e.preventDefault(); release(); }}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => { if (e.key === " " && !e.repeat) { e.preventDefault(); press(); } }}
      onKeyUp={(e) => { if (e.key === " ") { e.preventDefault(); release(); } }}
      onBlur={() => { if (pressedAt.current != null) cancel(); }}
      aria-pressed={recording}
      aria-label={hint}
      title={dimmed ? "Voice needs SLNG_API_KEY on the server" : hint}
      style={{ touchAction: "none", userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none" }}
      className={cn(
        "relative flex size-11 shrink-0 select-none items-center justify-center rounded-full border-2 transition-all touch-none",
        recording ? "border-red-500 bg-red-500 text-white" : "border-primary bg-primary/10 text-primary hover:bg-primary/20",
        (disabled || dimmed) && !recording && "opacity-40",
      )}
    >
      {recording && <span className="pointer-events-none absolute inset-0 rounded-full bg-red-500/40" style={{ transform: `scale(${1 + level * 0.9})`, transition: "transform 80ms linear" }} />}
      <span className="relative">{recording ? <Square className="size-4 fill-current" /> : <Mic className="size-5" />}</span>
    </button>
  );
}
