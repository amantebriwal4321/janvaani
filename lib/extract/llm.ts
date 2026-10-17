import "server-only";
import { z } from "zod";
import { CitizenProfileSchema, type CitizenProfile, type FieldEvidence, type ProfileKey } from "../profile/schema";
import { routerChat, type LlmResult } from "../slng";
import { LANG_IDS, type Lang } from "../models";

const PartialProfile = CitizenProfileSchema.partial();

const ExtractionSchema = z.object({
  fields: PartialProfile.default({}),
  evidence: z.array(z.object({ field: z.string(), quote: z.string(), confidence: z.number().min(0).max(1).default(0.8) })).default([]),
  detectedLanguage: z.enum(LANG_IDS).nullable().default(null),
});

export type Extraction = { delta: Partial<CitizenProfile>; evidence: FieldEvidence[]; detectedLanguage: Lang | null; llm: LlmResult };

const SYSTEM = `You convert what an Indian citizen says (Hindi, Kannada, Punjabi, Bhojpuri, Assamese, Telugu, Tamil, Marathi, English, or a code-mixed mix) into structured government-form fields.

Return ONLY a JSON object: {"fields": {...}, "evidence": [{"field": "...", "quote": "...", "confidence": 0-1}], "detectedLanguage": "hi|kn|pa|bho|as|te|ta|mr|en"}.

Field schema (omit fields not mentioned; never guess; null means unknown):
- state, district, village: strings. Karnataka districts: Kolar, Tumakuru, Mandya, Mysuru, Hassan, Belagavi, Dharwad, Ballari, Raichur, Kalaburagi, Bidar, Vijayapura, Davanagere, Shivamogga, Chitradurga, Udupi, Dakshina Kannada, Chikkaballapur, Ramanagara, Bengaluru Rural, Bengaluru Urban, Haveri, Gadag, Koppal, Yadgir, Chamarajanagar, Kodagu, Chikkamagaluru, Uttara Kannada, Bagalkot.
- areaType: "Rural" | "Urban" (gaon/halli/ooru/village -> Rural)
- age: integer. gender: "female" | "male" | "other". maritalStatus: "married" | "unmarried" | "widowed" | "divorced" | "separated".
- isWomanHeadOfHousehold: boolean (ration card mukhiya is a woman).
- occupation: short plain phrase in English. occupationClass: "farmer" | "farm_labourer" | "artisan" | "street_vendor" | "domestic_worker" | "construction" | "driver" | "gig_delivery" | "shopkeeper" | "salaried_private" | "govt_employee" | "student" | "homemaker" | "unemployed" | "retired" | "other".
- artisanTrade: e.g. tailor, carpenter, potter, blacksmith, cobbler, mason, barber, washerman, goldsmith, weaver.
- landAcres: number (1 acre = 40 guntas; 1 bigha ~ 0.6 acre; 1 hectare = 2.47 acres). isLandOwner: boolean (kiraye/lease/bataai -> false). hasLandRecord: boolean (RTC/Pahani/Khatauni/patta in own name).
- recentCropLoss: boolean. cropLossCause: string.
- annualIncomeBand: "under_1L" | "1L_to_2_5L" | "2_5L_to_5L" | "above_5L" (monthly x 12).
- rationCardType: "AAY" | "BPL" | "APL" | "none" (antyodaya/pink/yellow -> AAY).
- paysIncomeTax, govtEmployeeInFamily, hasEpfoOrEsic, hasDisability: boolean.
- householdMembers70Plus: integer count of family members aged 70 or more.
- housingType: "none" | "kutcha" | "semi_pucca" | "pucca".
- aadhaarNameMatchesRationCard, aadhaarLinkedMobile, bankAccountAadhaarSeeded: boolean, only when the citizen answers that specific question.

If the message is a yes/no answer and a "pendingField" is given, set that field from the answer.
Quotes in evidence must be verbatim substrings of the citizen's message.
Only include fields that are NEW or CHANGED compared to "Known so far". Do not repeat known values.

Examples:
Citizen: "Main Kolar ke paas ek gaon se hoon, 2 acre mein tamatar ugata hoon, umar 45 saal hai. Pitaji 72 saal ke hain."
-> {"fields":{"district":"Kolar","state":"Karnataka","areaType":"Rural","landAcres":2,"isLandOwner":true,"occupation":"tomato farmer","occupationClass":"farmer","age":45,"householdMembers70Plus":1},"evidence":[{"field":"age","quote":"umar 45 saal","confidence":0.95},{"field":"householdMembers70Plus","quote":"Pitaji 72 saal ke hain","confidence":0.9}],"detectedLanguage":"hi"}

Citizen: "ನಾನು ತುಮಕೂರಿನವನು, ವಯಸ್ಸು ೩೮. ಟೈಲರ್ ಕೆಲಸ ಮಾಡುತ್ತೇನೆ. ಬಿಪಿಎಲ್ ಕಾರ್ಡ್ ಇದೆ."
-> {"fields":{"district":"Tumakuru","state":"Karnataka","age":38,"occupation":"tailor","occupationClass":"artisan","artisanTrade":"tailor","rationCardType":"BPL"},"evidence":[{"field":"occupationClass","quote":"ಟೈಲರ್ ಕೆಲಸ","confidence":0.9},{"field":"rationCardType","quote":"ಬಿಪಿಎಲ್ ಕಾರ್ಡ್","confidence":0.95}],"detectedLanguage":"kn"}

Citizen: "నేను ఇంటి పని చేస్తాను, నా భర్త చనిపోయారు, వయసు 52."
-> {"fields":{"occupation":"domestic worker","occupationClass":"domestic_worker","maritalStatus":"widowed","gender":"female","age":52},"evidence":[{"field":"maritalStatus","quote":"నా భర్త చనిపోయారు","confidence":0.9}],"detectedLanguage":"te"}`;

export async function llmExtract(text: string, profile: CitizenProfile, pendingField: ProfileKey | null, sessionId: string): Promise<Extraction> {
  const known = Object.fromEntries(Object.entries(profile).filter(([, v]) => v != null));
  const user = `Known so far: ${JSON.stringify(known)}\npendingField: ${pendingField ?? "none"}\nCitizen said: """${text}"""`;
  const llm = await routerChat([{ role: "system", content: SYSTEM }, { role: "user", content: user }], sessionId, { json: true, maxTokens: 500, temperature: 0 });
  let parsed: z.infer<typeof ExtractionSchema>;
  try {
    const raw = JSON.parse(stripFences(llm.content));
    parsed = ExtractionSchema.parse(raw);
  } catch {
    return { delta: {}, evidence: [], detectedLanguage: null, llm };
  }
  const delta: Partial<CitizenProfile> = {};
  for (const [k, v] of Object.entries(parsed.fields)) if (v != null) (delta as Record<string, unknown>)[k] = v;
  const evidence: FieldEvidence[] = parsed.evidence
    .filter((e) => e.field in delta)
    .map((e) => ({ field: e.field as ProfileKey, quote: e.quote, origin: "spoken", confidence: e.confidence }));
  return { delta, evidence, detectedLanguage: parsed.detectedLanguage, llm };
}

function stripFences(s: string) {
  const m = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  return (m ? m[1] : s).trim();
}
