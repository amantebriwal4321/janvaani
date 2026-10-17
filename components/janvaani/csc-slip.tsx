"use client";

import { Printer, AlertTriangle, CheckSquare, Square } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FIELD_LABELS, acresToHectares, type ProfileKey } from "@/lib/profile/schema";
import { documentChecklist, fixFirst } from "@/lib/schemes/match";
import type { JanVaani } from "@/lib/client/use-janvaani";

const SHOW: ProfileKey[] = ["district", "village", "areaType", "age", "gender", "maritalStatus", "occupationClass", "sectorType", "landAcres", "rationCardType", "annualIncomeBand", "housingType", "householdMembers70Plus"];

const fmt = (v: unknown, k: ProfileKey) => {
  if (v == null) return "-";
  if (v === true) return "Yes";
  if (v === false) return "No";
  if (k === "landAcres" && typeof v === "number") return `${v} acres (${acresToHectares(v)} ha)`;
  return String(v).replace(/_/g, " ");
};

export function CscSlip({ jv, open, onOpenChange }: { jv: JanVaani; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { state, match } = jv;
  const p = state.profile;
  const schemes = [...match.eligible, ...match.likely];
  const docs = documentChecklist(match);
  const fixes = fixFirst(p);
  const audit: { label: string; value: boolean | null }[] = [
    { label: "Aadhaar name and DOB match the ration card", value: p.aadhaarNameMatchesRationCard },
    { label: "Mobile number linked to Aadhaar (for OTP)", value: p.aadhaarLinkedMobile },
    { label: "Bank account Aadhaar-seeded for DBT", value: p.bankAccountAadhaarSeeded },
  ];
  const ref = `JV-${state.sessionId.slice(3, 9).toUpperCase()}`;
  const date = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl print:max-h-none print:max-w-none print:border-0 print:shadow-none">
        <DialogHeader className="print:hidden">
          <DialogTitle>CSC Ready Slip</DialogTitle>
          <DialogDescription>Print this or show it on the phone at the Common Service Centre. Everything the operator needs to type is here, in the form&apos;s own words.</DialogDescription>
        </DialogHeader>

        <div id="csc-slip" className="rounded-xl border bg-white p-5 text-[13px] text-neutral-900 print:border-0 print:p-0">
          <div className="flex items-start justify-between border-b pb-3">
            <div>
              <p className="text-lg font-bold tracking-tight">JanVaani - CSC Ready Slip</p>
              <p className="text-xs text-neutral-500">जनवाणी पर्ची / ಜನವಾಣಿ ಚೀಟಿ - pre-filled from the citizen&apos;s own words</p>
            </div>
            <div className="text-right text-xs text-neutral-500">
              <p>Ref {ref}</p>
              <p>{date}</p>
            </div>
          </div>

          {fixes.length > 0 && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="flex items-center gap-1.5 font-semibold text-red-800"><AlertTriangle className="size-4" /> Fix before you travel to the CSC</p>
              <ol className="mt-1 list-decimal space-y-1 pl-5 text-red-900">
                {fixes.map((f) => <li key={f}>{f}</li>)}
              </ol>
            </div>
          )}

          <section className="mt-4">
            <h4 className="font-semibold">1. Apply for</h4>
            {schemes.length === 0 ? (
              <p className="text-neutral-500">No scheme confirmed yet.</p>
            ) : (
              <table className="mt-1 w-full border-collapse">
                <tbody>
                  {schemes.map((m) => (
                    <tr key={m.scheme.id} className="border-b align-top">
                      <td className="py-1.5 pr-2 font-medium">{m.scheme.name}<br /><span className="text-xs font-normal text-neutral-500">{m.scheme.nativeName}</span></td>
                      <td className="py-1.5 pr-2 text-xs">{m.scheme.benefit}</td>
                      <td className="py-1.5 text-xs text-neutral-600">
                        <span className="font-medium">Where:</span> {m.scheme.applyAt[0]}<br />
                        <span className="font-medium">Portal:</span> {m.scheme.portal.replace("https://", "")}
                        {m.verdict === "likely" && <><br /><span className="text-amber-700">Operator to verify: {m.missing.map((k) => FIELD_LABELS[k].label).join(", ") || m.reasons[0]}</span></>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="mt-4">
            <h4 className="font-semibold">2. Form fields (as the portal expects them)</h4>
            <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
              {SHOW.map((k) => (
                <div key={k} className="border-b border-dotted py-1">
                  <p className="text-[10px] uppercase tracking-wide text-neutral-500">{FIELD_LABELS[k].label}</p>
                  <p className="font-medium">{fmt(p[k], k)}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-4">
            <h4 className="font-semibold">3. Carry these documents</h4>
            {docs.length === 0 ? <p className="text-neutral-500">-</p> : (
              <ul className="mt-1 space-y-1">
                {docs.map((d) => (
                  <li key={d.doc} className="flex items-start gap-2">
                    <Square className="mt-0.5 size-3.5 shrink-0 text-neutral-400" />
                    <span>{d.doc} <span className="text-xs text-neutral-500">({d.forSchemes.length === schemes.length ? "all schemes" : d.forSchemes.join(", ")})</span></span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-4">
            <h4 className="font-semibold">4. Pre-CSC audit</h4>
            <ul className="mt-1 space-y-1">
              {audit.map((a) => (
                <li key={a.label} className="flex items-center gap-2">
                  {a.value === true ? <CheckSquare className="size-3.5 text-emerald-600" /> : a.value === false ? <AlertTriangle className="size-3.5 text-red-600" /> : <Square className="size-3.5 text-neutral-400" />}
                  <span className={a.value === false ? "text-red-800" : ""}>{a.label}{a.value == null && <span className="text-xs text-neutral-500"> - not checked</span>}</span>
                </li>
              ))}
            </ul>
          </section>

          <p className="mt-5 border-t pt-2 text-[10px] text-neutral-500">
            Eligibility is indicative, based on published scheme rules and what the citizen said. The CSC operator or portal makes the final determination. Generated by JanVaani on SLNG (Sarvam Saaras / Bulbul via in.api.slng.ai).
          </p>
        </div>

        <div className="flex justify-end gap-2 print:hidden">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={() => window.print()}><Printer data-icon="inline-start" /> Print / Save PDF</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
