"use client";

import { Activity } from "lucide-react";
import { SLNG_RATE_PER_MIN_USD } from "@/lib/models";
import type { JanVaani } from "@/lib/client/use-janvaani";
import { cn } from "@/lib/utils";

export function MetricsBar({ jv }: { jv: JanVaani }) {
  const { state } = jv;
  const last = [...state.metrics].reverse().find((m) => m.sttMs != null || m.llmMs != null || m.ttsMs != null);
  const voiceTurns = state.metrics.filter((m) => m.sttMs != null);
  const avg = (k: "sttMs" | "llmMs" | "ttsMs") => {
    const xs = state.metrics.map((m) => m[k]).filter((v): v is number => typeof v === "number" && v > 0);
    return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null;
  };
  const audioSec = state.metrics.reduce((n, m) => n + (m.audioSeconds ?? 0), 0);
  const estCost = (Math.max(audioSec, state.metrics.length * 4) / 60) * SLNG_RATE_PER_MIN_USD;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border bg-card/70 px-3 py-1.5 text-[11px] text-muted-foreground backdrop-blur">
      <span className="flex items-center gap-1 font-medium text-foreground"><Activity className="size-3.5 text-primary" /> Live telemetry</span>
      <Stat label="STT" value={last?.sttMs} avg={avg("sttMs")} model={last?.sttModel} />
      <Stat label="LLM" value={last?.llmMs} avg={avg("llmMs")} model={last?.llmModel} extra={last?.llmSource === "cache" ? "cache hit" : undefined} />
      <Stat label="TTS" value={last?.ttsMs} avg={avg("ttsMs")} model={last?.ttsModel} extra={last?.ttsFirstAudioMs ? `first audio ${last.ttsFirstAudioMs}ms` : undefined} />
      <span className="ml-auto flex items-center gap-3">
        <span>{state.metrics.length} turns, {voiceTurns.length} by voice</span>
        <span title={`${SLNG_RATE_PER_MIN_USD}/min SLNG agent rate`}>est. ${estCost.toFixed(4)}</span>
      </span>
    </div>
  );
}

function Stat({ label, value, avg, model, extra }: { label: string; value?: number; avg: number | null; model?: string; extra?: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="font-semibold text-foreground/80">{label}</span>
      <span className={cn("tabular-nums", value == null && "opacity-50")}>{value != null ? `${value} ms` : "-"}</span>
      {avg != null && <span className="opacity-70">avg {avg}</span>}
      {model && <span className="hidden rounded bg-muted px-1 py-px font-mono text-[10px] md:inline">{model.replace(":latest", "")}</span>}
      {extra && <span className="hidden text-emerald-700 lg:inline">{extra}</span>}
    </span>
  );
}
