"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Send, Square, Loader2, Volume2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { FIELD_LABELS } from "@/lib/profile/fields";
import { LANGS } from "@/lib/models";
import { cn } from "@/lib/utils";
import type { JanVaani } from "@/lib/client/use-janvaani";

const DEMOS: { label: string; text: string; lang: string }[] = [
  { label: "Kolar farmer", lang: "hi", text: "Main Kolar ke paas ek gaon se hoon, 2 acre mein tamatar ugata hoon, umar 45 saal hai. Is baar baarish se fasal kharab ho gayi. Ghar mein BPL card hai aur pitaji 72 saal ke hain." },
  { label: "Widow, domestic work", lang: "hi", text: "Mera naam Lakshmi, 52 saal, Mandya mein rehti hoon. Pati nahi rahe. Ghar ka kaam karti hoon do gharon mein. Ration card mein mera naam mukhiya hai. Ghar kachcha hai." },
  { label: "ಟೈಲರ್ (Kannada)", lang: "kn", text: "ನಾನು ತುಮಕೂರಿನವನು, ವಯಸ್ಸು ೩೮. ಟೈಲರ್ ಕೆಲಸ ಮಾಡುತ್ತೇನೆ, ಸ್ವಂತ ಅಂಗಡಿ ಇಲ್ಲ. ಬಿಪಿಎಲ್ ಕಾರ್ಡ್ ಇದೆ." },
  { label: "Auto driver, Bengaluru", lang: "en", text: "I drive an auto in Bangalore city, I am 34, no PF, no land. We have an APL ration card. My mother is 71 and lives with us." },
];

export function VoicePane({ jv }: { jv: JanVaani }) {
  const { state, status, micLevel, startMic, stopMic, sendText, health, playGreeting } = jv;
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const busy = status !== "idle" && status !== "recording";

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [state.transcript.length, status]);

  const submit = () => {
    if (!draft.trim() || busy) return;
    sendText(draft, "text");
    setDraft("");
  };

  return (
    <section className="flex h-full min-h-0 flex-col rounded-2xl border bg-card shadow-sm">
      <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Conversation</h2>
          <p className="text-xs text-muted-foreground">Hold to speak in Hindi, Kannada, Telugu, Tamil, Marathi or English</p>
        </div>
        <Badge variant="outline" className="gap-1 font-normal">
          <span className={cn("size-1.5 rounded-full", health?.slng ? "bg-emerald-500" : "bg-amber-500")} />
          {health == null ? "checking" : health.slng ? "SLNG India connected" : "Text-only mode"}
        </Badge>
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
                <button key={d.label} onClick={() => sendText(d.text, "text")} disabled={busy} className="rounded-full border bg-background px-3 py-1 text-xs hover:bg-muted disabled:opacity-50">
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
          <PushToTalk status={status} level={micLevel} disabled={busy} dimmed={health != null && !health.slng} onStart={startMic} onStop={stopMic} />
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
            placeholder={health?.slng ? "Or type here, e.g. Main Kolar se hoon, 2 acre kheti, umar 45" : "Type here, e.g. Main Kolar se hoon, 2 acre kheti, umar 45"}
            className="min-h-11 max-h-32 flex-1 resize-none text-[15px]"
            rows={1}
            disabled={busy}
          />
          <Button size="icon" className="size-11 shrink-0" onClick={submit} disabled={!draft.trim() || busy} aria-label="Send">
            <Send />
          </Button>
        </div>
        {state.transcript.length > 0 && state.stage !== "done" && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {DEMOS.slice(0, 2).map((d) => (
              <button key={d.label} onClick={() => sendText(d.text, "text")} disabled={busy} className="rounded-full border px-2.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted disabled:opacity-50">
                {d.label}
              </button>
            ))}
          </div>
        )}
      </footer>
    </section>
  );
}

// Never disabled while idle: pressing it with no SLNG key or in an insecure
// context produces an explanatory banner instead of a silent dead button.
function PushToTalk({ status, level, disabled, dimmed, onStart, onStop }: { status: string; level: number; disabled: boolean; dimmed: boolean; onStart: () => void; onStop: () => void }) {
  const recording = status === "recording";
  return (
    <button
      type="button"
      disabled={disabled && !recording}
      onPointerDown={(e) => { e.preventDefault(); if (!recording) onStart(); }}
      onPointerUp={(e) => { e.preventDefault(); if (recording) onStop(); }}
      onPointerLeave={() => { if (recording) onStop(); }}
      onKeyDown={(e) => { if (e.key === " " && !recording) { e.preventDefault(); onStart(); } }}
      onKeyUp={(e) => { if (e.key === " " && recording) { e.preventDefault(); onStop(); } }}
      aria-pressed={recording}
      aria-label={recording ? "Release to send" : "Hold to speak"}
      title={dimmed ? "Voice needs SLNG_API_KEY on the server" : "Hold to speak"}
      className={cn(
        "relative flex size-11 shrink-0 select-none items-center justify-center rounded-full border-2 transition-all touch-none",
        recording ? "border-red-500 bg-red-500 text-white" : "border-primary bg-primary/10 text-primary hover:bg-primary/20",
        (disabled || dimmed) && !recording && "opacity-40",
      )}
    >
      {recording && <span className="absolute inset-0 rounded-full bg-red-500/40" style={{ transform: `scale(${1 + level * 0.9})`, transition: "transform 80ms linear" }} />}
      <span className="relative">{recording ? <Square className="size-4 fill-current" /> : <Mic className="size-5" />}</span>
    </button>
  );
}
