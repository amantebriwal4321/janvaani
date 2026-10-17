"use client";

import { useState } from "react";
import { CheckCircle2, CircleHelp, Ban, Sparkles, Printer, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FIELD_LABELS } from "@/lib/profile/fields";
import type { SchemeMatch } from "@/lib/schemes/match";
import { cn } from "@/lib/utils";
import type { JanVaani } from "@/lib/client/use-janvaani";
import { CscSlip } from "./csc-slip";

export function MatchesPane({ jv }: { jv: JanVaani }) {
  const { match, state } = jv;
  const [slipOpen, setSlipOpen] = useState(false);
  const [showBlocked, setShowBlocked] = useState(false);
  const confirmed = match.eligible.length + match.likely.length;
  const canSlip = confirmed > 0;

  return (
    <section className="flex h-full min-h-0 flex-col rounded-2xl border bg-card shadow-sm">
      <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">Schemes for you</h2>
        </div>
        <Button size="sm" onClick={() => setSlipOpen(true)} disabled={!canSlip} variant={state.stage === "done" ? "default" : "outline"}>
          <Printer data-icon="inline-start" /> CSC Ready Slip
        </Button>
      </header>
      <div className="flex-1 min-h-0 space-y-4 overflow-y-auto px-4 py-3">
        {confirmed === 0 && match.unknown.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">Nothing matched yet. As soon as the citizen mentions their work, age or ration card, schemes appear here.</p>
        )}
        <Group title="You qualify" icon={<CheckCircle2 className="size-4 text-emerald-600" />} items={match.eligible} tone="eligible" />
        <Group title="Very likely, one more check" icon={<CheckCircle2 className="size-4 text-amber-600" />} items={match.likely} tone="likely" />
        <Group title="Need one answer to know" icon={<CircleHelp className="size-4 text-chart-3" />} items={match.unknown.filter((m) => m.missing.length > 0 || m.reasons.length > 0)} tone="unknown" />
        {match.blocked.length > 0 && (
          <div>
            <button onClick={() => setShowBlocked((v) => !v)} className="flex w-full items-center gap-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Ban className="size-3.5" /> Not for you ({match.blocked.length})
              <ChevronDown className={cn("ml-auto size-3.5 transition-transform", showBlocked && "rotate-180")} />
            </button>
            {showBlocked && (
              <ul className="mt-2 space-y-1">
                {match.blocked.map((m) => (
                  <li key={m.scheme.id} className="rounded-lg border border-dashed px-3 py-1.5 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground/70">{m.scheme.name}</span>: {m.reasons[0]}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      <CscSlip jv={jv} open={slipOpen} onOpenChange={setSlipOpen} />
    </section>
  );
}

function Group({ title, icon, items, tone }: { title: string; icon: React.ReactNode; items: SchemeMatch[]; tone: "eligible" | "likely" | "unknown" }) {
  if (!items.length) return null;
  return (
    <div>
      <h3 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{icon}{title}</h3>
      <ul className="space-y-2">
        {items.map((m) => (
          <li key={m.scheme.id} className={cn("rounded-xl border p-3 transition-shadow", tone === "eligible" && "border-emerald-200 bg-emerald-50/60", tone === "likely" && "border-amber-200 bg-amber-50/60", tone === "unknown" && "bg-background")}>
            <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
              <div>
                <p className="text-sm font-semibold leading-tight">{m.scheme.name}</p>
                <p className="text-xs text-muted-foreground">{m.scheme.nativeName}</p>
              </div>
              <Badge variant="outline" className="h-5 text-[10px]">{m.scheme.level}</Badge>
            </div>
            <p className="mt-1.5 text-[13px] font-medium text-foreground/90">{m.scheme.benefit}</p>
            {m.reasons.length > 0 && <p className="mt-1 text-xs text-muted-foreground">{tone === "unknown" ? "Why unsure: " : "Why: "}{m.reasons.join(". ")}</p>}
            {m.missing.length > 0 && (
              <p className="mt-1 text-xs text-chart-3">Still need: {m.missing.map((k) => FIELD_LABELS[k].label.toLowerCase()).join(", ")}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
