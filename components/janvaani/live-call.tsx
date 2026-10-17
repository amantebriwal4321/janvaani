"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PhoneCall, PhoneOff, Loader2, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type CallState = "idle" | "connecting" | "live" | "ended" | "error";
type Line = { who: "agent" | "you"; text: string; final: boolean };

// Live Call mode: full-duplex WebRTC conversation with the SLNG-hosted
// JanVaani agent (declared in unmute/janvaani). The browser joins the LiveKit
// room the agent runtime creates; STT, LLM and TTS all run on SLNG.
export function LiveCall({ enabled }: { enabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [call, setCall] = useState<CallState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [secs, setSecs] = useState(0);
  const roomRef = useRef<import("livekit-client").Room | null>(null);
  const audioElRef = useRef<HTMLDivElement>(null);

  const hangup = useCallback(async () => {
    const room = roomRef.current;
    roomRef.current = null;
    if (room) await room.disconnect();
    setCall((c) => (c === "error" ? c : "ended"));
    setAgentSpeaking(false);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setLines([]);
    setSecs(0);
    setCall("connecting");
    try {
      const res = await fetch("/api/session", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start the call");
      const lk = await import("livekit-client");
      const room = new lk.Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;

      room.on(lk.RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === lk.Track.Kind.Audio && audioElRef.current) {
          const el = track.attach();
          el.autoplay = true;
          audioElRef.current.appendChild(el);
        }
      });
      room.on(lk.RoomEvent.TrackUnsubscribed, (track) => track.detach().forEach((el) => el.remove()));
      room.on(lk.RoomEvent.ActiveSpeakersChanged, (speakers) => {
        setAgentSpeaking(speakers.some((p) => p.identity !== room.localParticipant.identity));
      });
      room.on(lk.RoomEvent.Disconnected, () => { roomRef.current = null; setCall((c) => (c === "error" ? c : "ended")); });
      room.registerTextStreamHandler("lk.transcription", async (reader, participant) => {
        const text = await reader.readAll();
        const who: Line["who"] = participant?.identity === room.localParticipant.identity ? "you" : "agent";
        const final = reader.info.attributes?.["lk.transcription_final"] === "true";
        const segment = reader.info.attributes?.["lk.segment_id"] ?? reader.info.id;
        setLines((prev) => {
          const idx = prev.findIndex((l) => l.who === who && !l.final && (l as Line & { seg?: string }).seg === segment);
          const line = Object.assign({ who, text, final }, { seg: segment });
          if (idx >= 0) { const next = [...prev]; next[idx] = line; return next; }
          return [...prev, line];
        });
      });

      await room.connect(data.livekitUrl, data.token);
      await room.localParticipant.setMicrophoneEnabled(true);
      await room.startAudio();
      setCall("live");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Call failed");
      setCall("error");
      await hangup();
    }
  }, [hangup]);

  useEffect(() => {
    if (call !== "live") return;
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [call]);

  useEffect(() => {
    if (!open && roomRef.current) hangup();
  }, [open, hangup]);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} disabled={!enabled} title={enabled ? "Talk to the hosted agent over WebRTC" : "Needs SLNG_API_KEY and SLNG_AGENT_ID"}>
        <PhoneCall data-icon="inline-start" /> Live Call
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Radio className="size-4 text-primary" /> Live Call with JanVaani agent</DialogTitle>
            <DialogDescription>Full-duplex phone-style conversation. The agent runs on SLNG (Saaras v3 ears, hosted LLM, Bulbul v3 voice) from the <code className="font-mono text-xs">unmute/janvaani</code> spec; you can interrupt it mid-sentence.</DialogDescription>
          </DialogHeader>
          <div ref={audioElRef} className="hidden" />
          <div className="flex items-center justify-between rounded-xl border bg-muted/40 px-4 py-3">
            <div className="flex items-center gap-3">
              <span className={cn("flex size-10 items-center justify-center rounded-full", call === "live" ? "bg-emerald-500/15 text-emerald-700" : "bg-muted text-muted-foreground")}>
                {call === "connecting" ? <Loader2 className="size-5 animate-spin" /> : <PhoneCall className="size-5" />}
              </span>
              <div>
                <p className="text-sm font-medium">
                  {call === "idle" && "Ready to call"}
                  {call === "connecting" && "Connecting to ap-south LiveKit..."}
                  {call === "live" && (agentSpeaking ? "JanVaani is speaking" : "Listening to you")}
                  {call === "ended" && "Call ended"}
                  {call === "error" && "Call failed"}
                </p>
                <p className="text-xs tabular-nums text-muted-foreground">{call === "live" ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}` : "Mic permission is requested when you call"}</p>
              </div>
            </div>
            {call === "live" || call === "connecting" ? (
              <Button variant="destructive" size="sm" onClick={hangup}><PhoneOff data-icon="inline-start" /> Hang up</Button>
            ) : (
              <Button size="sm" onClick={start}><PhoneCall data-icon="inline-start" /> {call === "idle" ? "Call" : "Call again"}</Button>
            )}
          </div>
          {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}
          <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-xl border p-3 text-sm">
            {lines.length === 0 && <p className="text-center text-xs text-muted-foreground">{call === "live" ? "Say hello. Live captions appear here." : "Captions of the call will appear here."}</p>}
            {lines.map((l, i) => (
              <p key={i} className={cn(l.who === "you" ? "text-right" : "", !l.final && "opacity-60")}>
                <span className="mr-1 text-[10px] uppercase text-muted-foreground">{l.who === "you" ? "you" : "janvaani"}</span>{l.text}
              </p>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
