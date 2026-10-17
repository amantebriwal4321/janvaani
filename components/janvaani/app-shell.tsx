"use client";

import { useCallback, useState } from "react";
import { Download, RotateCcw, X, Mic, FileText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useJanVaani } from "@/lib/client/use-janvaani";
import { cn } from "@/lib/utils";
import { VoicePane } from "./voice-pane";
import { FormPane } from "./form-pane";
import { MatchesPane } from "./matches-pane";
import { MetricsBar } from "./metrics-bar";
import { SettingsPanel } from "./settings-panel";
import { LiveCall } from "./live-call";
import { AudienceStage } from "./audience-stage";

type Tab = "talk" | "form" | "schemes";

export function AppShell() {
  const jv = useJanVaani();
  const [tab, setTab] = useState<Tab>("talk");
  const [phase, setPhase] = useState<"ring" | "opening" | "desk">("ring");
  const confirmed = jv.match.eligible.length + jv.match.likely.length;
  const openDesk = useCallback(() => {
    setPhase((current) => {
      if (current !== "ring") return current;
      window.setTimeout(() => setPhase("desk"), 780);
      return "opening";
    });
  }, []);

  return (
    <TooltipProvider>
      {phase !== "desk" && (
        <div className={phase === "opening" ? "stage-leave" : "fixed inset-0 z-40"}>
          <AudienceStage onEnter={openDesk} autoOpen={phase === "ring"} />
        </div>
      )}
      {phase !== "ring" && (
      <div className={cn("flex min-h-dvh flex-col gap-3 p-3 md:h-dvh md:p-4", phase === "opening" && "desk-enter")}>
        <header className="flex flex-wrap items-center justify-between gap-2 print:hidden">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Mic className="size-4" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-none tracking-tight">JanVaani <span className="font-normal text-muted-foreground">जनवाणी</span></h1>
              <p className="text-xs text-muted-foreground">Speak once. The welfare form fills itself, and you leave with a CSC Ready Slip.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <LiveCall enabled={Boolean(jv.health?.liveCall)} />
            <SettingsPanel jv={jv} />
            <Button variant="ghost" size="sm" onClick={jv.exportSession} disabled={jv.state.transcript.length === 0} title="Download session JSON">
              <Download data-icon="inline-start" /> Export
            </Button>
            <Button variant="ghost" size="sm" onClick={jv.reset} disabled={jv.state.transcript.length === 0}>
              <RotateCcw data-icon="inline-start" /> New citizen
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setPhase("ring")}>
              People
            </Button>
          </div>
        </header>

        {jv.error && (
          <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 print:hidden">
            <span>{jv.error}</span>
            <button onClick={() => jv.setError(null)} aria-label="Dismiss" className="shrink-0 opacity-60 hover:opacity-100"><X className="size-4" /></button>
          </div>
        )}

        <nav className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1 md:hidden print:hidden">
          {([["talk", "Talk", Mic], ["form", "Form", FileText], ["schemes", `Schemes${confirmed ? ` (${confirmed})` : ""}`, Sparkles]] as const).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)} className={cn("flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-colors", tab === id ? "bg-background shadow-sm" : "text-muted-foreground")}>
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </nav>

        <main className="grid flex-1 min-h-0 grid-cols-1 gap-3 md:grid-cols-12 print:block">
          <div className={cn("min-h-[60dvh] md:col-span-4 md:min-h-0", tab !== "talk" && "hidden md:block")}><VoicePane jv={jv} /></div>
          <div className={cn("min-h-[60dvh] md:col-span-4 md:min-h-0", tab !== "form" && "hidden md:block")}><FormPane jv={jv} /></div>
          <div className={cn("min-h-[60dvh] md:col-span-4 md:min-h-0", tab !== "schemes" && "hidden md:block")}><MatchesPane jv={jv} /></div>
        </main>

        <div className="print:hidden"><MetricsBar jv={jv} /></div>
      </div>
      )}
    </TooltipProvider>
  );
}
