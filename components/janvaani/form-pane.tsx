"use client";

import { useState } from "react";
import { FileText, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { FIELD_LABELS, JARGON, acresToHectares, type CitizenProfile, type ProfileKey } from "@/lib/profile/schema";
import { cn } from "@/lib/utils";
import type { JanVaani } from "@/lib/client/use-janvaani";

type Section = { title: string; fields: ProfileKey[] };

const SECTIONS: Section[] = [
  { title: "Where you live", fields: ["state", "district", "village", "areaType"] },
  { title: "About you", fields: ["age", "gender", "maritalStatus", "isWomanHeadOfHousehold", "householdMembers70Plus"] },
  { title: "Work", fields: ["occupation", "occupationClass", "sectorType", "artisanTrade", "hasEpfoOrEsic"] },
  { title: "Land and crops", fields: ["landAcres", "isLandOwner", "hasLandRecord", "recentCropLoss", "cropLossCause"] },
  { title: "Household economics", fields: ["rationCardType", "annualIncomeBand", "housingType", "paysIncomeTax", "govtEmployeeInFamily"] },
  { title: "Pre-CSC checks", fields: ["aadhaarNameMatchesRationCard", "aadhaarLinkedMobile", "bankAccountAadhaarSeeded"] },
];

const OPTIONS: Partial<Record<ProfileKey, string[]>> = {
  areaType: ["Rural", "Urban"],
  gender: ["female", "male", "other"],
  maritalStatus: ["married", "unmarried", "widowed", "divorced", "separated"],
  occupationClass: ["farmer", "farm_labourer", "artisan", "street_vendor", "domestic_worker", "construction", "driver", "gig_delivery", "shopkeeper", "salaried_private", "govt_employee", "student", "homemaker", "unemployed", "retired", "other"],
  sectorType: ["Organised", "Unorganised"],
  rationCardType: ["AAY", "BPL", "APL", "none"],
  annualIncomeBand: ["under_1L", "1L_to_2_5L", "2_5L_to_5L", "above_5L"],
  housingType: ["none", "kutcha", "semi_pucca", "pucca"],
};

const BOOL: ProfileKey[] = ["isWomanHeadOfHousehold", "isLandOwner", "hasLandRecord", "recentCropLoss", "paysIncomeTax", "govtEmployeeInFamily", "hasEpfoOrEsic", "hasDisability", "aadhaarNameMatchesRationCard", "aadhaarLinkedMobile", "bankAccountAadhaarSeeded"];
const NUM: ProfileKey[] = ["age", "landAcres", "householdMembers70Plus"];

const pretty = (v: unknown) => {
  if (v === true) return "Yes";
  if (v === false) return "No";
  if (typeof v === "string") return v.replace(/_/g, " ").replace("2 5L", "2.5L").replace(/\bL\b/g, "lakh");
  return String(v);
};

export function FormPane({ jv }: { jv: JanVaani }) {
  const { state, setField } = jv;
  const p = state.profile;
  const total = SECTIONS.reduce((n, s) => n + s.fields.length, 0);
  const filled = SECTIONS.reduce((n, s) => n + s.fields.filter((f) => p[f] != null).length, 0);
  const flash = state.recentFields;
  const flashKey = state.transcript.length;

  return (
    <section className="flex h-full min-h-0 flex-col rounded-2xl border bg-card shadow-sm">
      <header className="border-b px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-primary" />
            <h2 className="text-sm font-semibold">Citizen profile (the form, filled live)</h2>
          </div>
          <span className="text-xs tabular-nums text-muted-foreground">{filled}/{total}</span>
        </div>
        <Progress value={(filled / total) * 100} className="mt-2 h-1.5" />
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
        {SECTIONS.map((s) => (
          <div key={s.title} className="mb-4">
            <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{s.title}</h3>
            <div className="divide-y rounded-xl border">
              {s.fields.map((f) => (
                <FieldRow key={f} field={f} value={p[f]} evidence={state.evidence.find((e) => e.field === f)} flash={flash.includes(f)} flashKey={flashKey} pending={state.pendingField === f} onChange={(v) => setField(f, v)} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FieldRow({ field, value, evidence, flash, flashKey, pending, onChange }: { field: ProfileKey; value: CitizenProfile[ProfileKey]; evidence?: { quote: string; origin: string; confidence: number }; flash: boolean; flashKey: number; pending: boolean; onChange: (v: unknown) => void }) {
  const [editing, setEditing] = useState(false);
  const meta = FIELD_LABELS[field];
  const jargon = typeof value === "string" ? JARGON[field]?.[value] : undefined;
  const empty = value == null;

  return (
    <div key={flash ? flashKey : undefined} className={cn("flex items-start gap-3 px-3 py-2", flash && "animate-field-flash", pending && empty && "bg-primary/5")}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-[13px] font-medium">{meta.label}</span>
          {meta.plain && <span className="text-[11px] text-muted-foreground">{meta.plain}</span>}
          {pending && empty && <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">asking now</Badge>}
        </div>
        {!editing ? (
          <button type="button" onClick={() => setEditing(true)} className={cn("group mt-0.5 flex w-full items-center gap-1.5 text-left", empty && "text-muted-foreground/60")}>
            <span className={cn("text-[15px]", !empty && "font-semibold")}>
              {empty ? "not yet" : pretty(value)}
              {field === "landAcres" && typeof value === "number" && <span className="ml-1 text-xs font-normal text-muted-foreground">= {acresToHectares(value)} ha</span>}
            </span>
            <Pencil className="size-3 opacity-0 transition-opacity group-hover:opacity-60" />
          </button>
        ) : (
          <Editor field={field} value={value} onDone={(v) => { if (v !== undefined) onChange(v); setEditing(false); }} />
        )}
        {jargon && <p className="mt-0.5 text-[11px] text-accent-foreground">{jargon}</p>}
      </div>
      {evidence && (
        <Tooltip>
          <TooltipTrigger
            render={<span className={cn("mt-1 shrink-0 rounded-full px-1.5 py-px text-[10px]", evidence.origin === "typed" ? "bg-secondary" : evidence.origin === "asked" ? "bg-chart-3/15 text-chart-3" : "bg-primary/10 text-primary")} />}
          >
            {evidence.origin === "typed" ? "edited" : evidence.origin === "asked" ? "answered" : "heard"}
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-xs">
            {evidence.quote ? <>From: &ldquo;{evidence.quote}&rdquo;</> : "Inferred from what was said"}
            <span className="ml-1 opacity-70">({Math.round(evidence.confidence * 100)}%)</span>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

function Editor({ field, value, onDone }: { field: ProfileKey; value: unknown; onDone: (v: unknown) => void }) {
  const [v, setV] = useState<string>(value == null ? "" : String(value));
  if (BOOL.includes(field)) {
    return (
      <div className="mt-1 flex gap-1.5">
        {[["true", "Yes"], ["false", "No"]].map(([val, label]) => (
          <button key={val} onClick={() => onDone(val === "true")} className="rounded-md border px-2 py-0.5 text-xs hover:bg-muted">{label}</button>
        ))}
        <button onClick={() => onDone(undefined)} className="px-2 text-xs text-muted-foreground">cancel</button>
      </div>
    );
  }
  if (OPTIONS[field]) {
    return (
      <Select defaultOpen value={v} onValueChange={(val) => val != null && onDone(val)}>
        <SelectTrigger className="mt-1 h-8 w-full text-sm"><SelectValue placeholder="choose" /></SelectTrigger>
        <SelectContent>
          {OPTIONS[field]!.map((o) => <SelectItem key={o} value={o}>{pretty(o)}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  }
  return (
    <Input
      autoFocus
      type={NUM.includes(field) ? "number" : "text"}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => onDone(v === "" ? undefined : NUM.includes(field) ? Number(v) : v)}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") onDone(undefined); }}
      className="mt-1 h-8 text-sm"
    />
  );
}
