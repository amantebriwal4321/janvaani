import "server-only";
import { AUDIT_FIELDS, CitizenProfileSchema, mergeProfile, type CitizenProfile, type FieldEvidence, type ProfileKey } from "./profile/schema";
import { matchSchemes, readyForAudit, nextAuditField, type MatchSummary } from "./schemes/match";
import { ruleExtract, parseYesNo, detectLanguage } from "./extract/rules";
import { llmExtract } from "./extract/llm";
import { composeReply, type Stage } from "./dialogue";
import { hasSlng } from "./env";
import type { Lang } from "./models";
import type { LlmResult } from "./slng";

export type TurnInput = {
  text: string;
  profile: CitizenProfile;
  stage: Stage;
  pendingField: ProfileKey | null;
  lang: Lang | "auto";
  sessionId: string;
  useLlm: boolean;
};

export type TurnOutput = {
  profile: CitizenProfile;
  delta: Partial<CitizenProfile>;
  evidence: FieldEvidence[];
  match: MatchSummary;
  stage: Stage;
  pendingField: ProfileKey | null;
  reply: string;
  lang: Lang;
  llm: { used: boolean; ms: number; model: string; source: string; fallback?: string } | null;
  newlyEligible: string[];
};

export async function runTurn(input: TurnInput): Promise<TurnOutput> {
  const profile = CitizenProfileSchema.parse(input.profile);
  const before = matchSchemes(profile);
  const text = input.text.trim();

  // 1. deterministic pass (always runs, zero cost, instant)
  const rules = ruleExtract(text);
  const delta: Partial<CitizenProfile> = { ...rules.delta };
  let evidence: FieldEvidence[] = [...rules.evidence];

  // yes/no answer to a pending boolean question
  if (input.pendingField && isBooleanField(input.pendingField) && delta[input.pendingField] === undefined) {
    const yn = parseYesNo(text);
    if (yn !== null) {
      (delta as Record<string, unknown>)[input.pendingField] = yn;
      evidence.push({ field: input.pendingField, quote: text.slice(0, 60), origin: "asked", confidence: 0.9 });
    }
  }
  // "no" to the 70+ question
  if (input.pendingField === "householdMembers70Plus" && delta.householdMembers70Plus === undefined) {
    const yn = parseYesNo(text);
    if (yn === false) { delta.householdMembers70Plus = 0; evidence.push({ field: "householdMembers70Plus", quote: text.slice(0, 60), origin: "asked", confidence: 0.9 }); }
    if (yn === true) { delta.householdMembers70Plus = 1; evidence.push({ field: "householdMembers70Plus", quote: text.slice(0, 60), origin: "asked", confidence: 0.7 }); }
  }
  // numeric answer to a numeric question
  if (input.pendingField && (input.pendingField === "age" || input.pendingField === "landAcres") && delta[input.pendingField] === undefined) {
    const n = text.match(/\d+(\.\d+)?/);
    if (n) { (delta as Record<string, unknown>)[input.pendingField] = parseFloat(n[0]); evidence.push({ field: input.pendingField, quote: n[0], origin: "asked", confidence: 0.8 }); }
  }

  // 2. LLM pass through SLNG Context Router (fills what rules missed; rules win on conflict for audit fields)
  let llmInfo: TurnOutput["llm"] = null;
  let detected: Lang | null = null;
  if (input.useLlm && hasSlng() && text.length > 0) {
    try {
      const r = await llmExtract(text, profile, input.pendingField, input.sessionId);
      detected = r.detectedLanguage;
      const haystack = normalizeForMatch(text);
      for (const [k, v] of Object.entries(r.delta) as [ProfileKey, unknown][]) {
        if (v == null) continue;
        if ((delta as Record<string, unknown>)[k] !== undefined) continue;
        // Hallucination guard: small models invent "false" for every boolean they
        // were told about. Accept a model field only when it points at words the
        // citizen actually said, and never let it answer the audit questions.
        if (AUDIT_FIELDS.includes(k) && input.pendingField !== k) continue;
        const ev = r.evidence.find((e) => e.field === k);
        const quoted = ev?.quote ? haystack.includes(normalizeForMatch(ev.quote)) : false;
        const literal = typeof v === "string" && haystack.includes(normalizeForMatch(v));
        const answered = input.pendingField === k;
        if (!quoted && !literal && !answered) continue;
        (delta as Record<string, unknown>)[k] = v;
        evidence.push(ev && quoted ? ev : { field: k, quote: typeof v === "string" ? v : "", origin: answered ? "asked" : "spoken", confidence: 0.6 });
      }
      llmInfo = { used: true, ms: r.llm.ms, model: r.llm.model, source: r.llm.source };
    } catch (e) {
      llmInfo = { used: false, ms: 0, model: "rules-only", source: "fallback", fallback: e instanceof Error ? e.message : "LLM unavailable" };
    }
  }

  const lang: Lang = input.lang !== "auto" ? input.lang : detected ?? detectLanguage(text);

  // Only report what actually changed; models like to echo known fields back.
  for (const k of Object.keys(delta) as ProfileKey[]) {
    if (profile[k] != null && JSON.stringify(profile[k]) === JSON.stringify(delta[k])) {
      delete delta[k];
      evidence = evidence.filter((e) => e.field !== k);
    }
  }

  // 3. merge + derive + match
  const merged = mergeProfile(profile, delta);
  const after = matchSchemes(merged);
  const beforeIds = new Set([...before.eligible, ...before.likely].map((m) => m.scheme.id));
  const newlyEligible = [...after.eligible, ...after.likely].map((m) => m.scheme.id).filter((id) => !beforeIds.has(id));

  // 4. stage machine
  let stage: Stage = input.stage;
  let nextField: ProfileKey | null = null;
  if (stage === "intake") {
    if (readyForAudit(merged, after) && (after.nextField == null || after.unlocks <= 1 || coreCount(merged) >= 5)) {
      stage = "audit";
      nextField = nextAuditField(merged);
    } else {
      nextField = after.nextField;
    }
  }
  if (stage === "audit") {
    nextField = nextAuditField(merged);
    if (!nextField) stage = "done";
  }
  if (stage === "done") nextField = null;

  const reply = composeReply({ lang, profile: merged, match: after, extractedAnything: Object.keys(delta).length > 0, stage, nextField, newlyEligible });

  return { profile: merged, delta, evidence, match: after, stage, pendingField: nextField, reply, lang, llm: llmInfo, newlyEligible };
}

const isBooleanField = (k: ProfileKey) => BOOL_FIELDS.has(k);
const normalizeForMatch = (s: string) => s.toLowerCase().replace(/[\s.,;:!?"'`()\-]+/g, " ").trim();
const BOOL_FIELDS = new Set<ProfileKey>(["isWomanHeadOfHousehold", "isLandOwner", "hasLandRecord", "recentCropLoss", "paysIncomeTax", "govtEmployeeInFamily", "hasEpfoOrEsic", "hasDisability", "aadhaarNameMatchesRationCard", "aadhaarLinkedMobile", "bankAccountAadhaarSeeded"]);

function coreCount(p: CitizenProfile) {
  return (["age", "occupationClass", "areaType", "landAcres", "rationCardType", "maritalStatus", "householdMembers70Plus", "housingType"] as ProfileKey[]).filter((k) => p[k] != null).length;
}

export type { LlmResult };
