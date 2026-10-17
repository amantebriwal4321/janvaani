import type { CitizenProfile, ProfileKey } from "../profile/schema";
import { AUDIT_FIELDS } from "../profile/schema";
import { SCHEMES, type RuleResult, type Scheme } from "./catalog";

export type SchemeMatch = RuleResult & { scheme: Scheme };

export type MatchSummary = {
  eligible: SchemeMatch[];
  likely: SchemeMatch[];
  unknown: SchemeMatch[];
  blocked: SchemeMatch[];
  nextField: ProfileKey | null;
  unlocks: number;
};

const LAND_FIELDS: ProfileKey[] = ["landAcres", "isLandOwner", "hasLandRecord", "recentCropLoss"];
const CORE_ORDER: ProfileKey[] = ["age", "occupationClass", "areaType", "landAcres", "rationCardType", "maritalStatus", "householdMembers70Plus", "housingType"];

export function matchSchemes(p: CitizenProfile): MatchSummary {
  const all: SchemeMatch[] = SCHEMES.map((scheme) => ({ scheme, ...scheme.rule(p) }));
  const by = (v: RuleResult["verdict"]) => all.filter((m) => m.verdict === v);

  const score = new Map<ProfileKey, number>();
  for (const m of all) {
    if (m.verdict === "blocked") continue;
    for (const k of m.missing) {
      if (AUDIT_FIELDS.includes(k)) continue;
      let w = m.verdict === "unknown" ? 2 : 1;
      // Don't lead with farmland questions for someone who just said they are a tailor or a driver.
      if (LAND_FIELDS.includes(k) && p.occupationClass && !["farmer", "farm_labourer", "other"].includes(p.occupationClass)) w *= 0.4;
      score.set(k, (score.get(k) ?? 0) + w);
    }
  }
  if (score.size === 0) {
    const first = CORE_ORDER.find((k) => p[k] == null);
    return { eligible: by("eligible"), likely: by("likely"), unknown: by("unknown"), blocked: by("blocked"), nextField: first ?? null, unlocks: 0 };
  }
  let best: ProfileKey | null = null;
  let bestScore = -1;
  for (const [k, s] of score) {
    const tiebreak = CORE_ORDER.indexOf(k);
    const adj = s * 10 - (tiebreak === -1 ? 9 : tiebreak);
    if (adj > bestScore) { bestScore = adj; best = k; }
  }
  return { eligible: by("eligible"), likely: by("likely"), unknown: by("unknown"), blocked: by("blocked"), nextField: best, unlocks: best ? score.get(best) ?? 0 : 0 };
}

export function readyForAudit(p: CitizenProfile, m: MatchSummary): boolean {
  const confirmed = m.eligible.length + m.likely.length;
  const coreFilled = CORE_ORDER.filter((k) => p[k] != null).length;
  return confirmed >= 1 && (coreFilled >= 4 || m.nextField == null);
}

export function nextAuditField(p: CitizenProfile): ProfileKey | null {
  return AUDIT_FIELDS.find((k) => p[k] == null) ?? null;
}

export function documentChecklist(m: MatchSummary): { doc: string; forSchemes: string[] }[] {
  const map = new Map<string, Set<string>>();
  for (const x of [...m.eligible, ...m.likely]) {
    for (const d of x.scheme.documents) {
      if (!map.has(d)) map.set(d, new Set());
      map.get(d)!.add(x.scheme.name);
    }
  }
  return [...map.entries()].map(([doc, s]) => ({ doc, forSchemes: [...s] })).sort((a, b) => b.forSchemes.length - a.forSchemes.length);
}

export function fixFirst(p: CitizenProfile): string[] {
  const out: string[] = [];
  if (p.aadhaarNameMatchesRationCard === false) out.push("Name or date of birth differs between Aadhaar and ration card. Get it corrected at the Aadhaar centre or Food & Civil Supplies office before applying; mismatches are the top rejection reason.");
  if (p.aadhaarLinkedMobile === false) out.push("Mobile number is not linked to Aadhaar. Every portal sends an OTP to the Aadhaar mobile; update it at an Aadhaar Seva Kendra (Rs 50).");
  if (p.bankAccountAadhaarSeeded === false) out.push("Bank account is not Aadhaar-seeded for DBT. Ask the bank branch to seed Aadhaar (NPCI mapper) or no money can be transferred.");
  if (p.hasLandRecord === false) out.push("Land record is not in your name. Visit the Village Accountant / Nadakacheri for the RTC (Pahani) mutation before PM-KISAN or crop insurance.");
  return out;
}
