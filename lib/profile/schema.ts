import { z } from "zod";

export const AreaType = z.enum(["Rural", "Urban"]);
export const Gender = z.enum(["female", "male", "other"]);
export const MaritalStatus = z.enum(["married", "unmarried", "widowed", "divorced", "separated"]);
export const OccupationClass = z.enum([
  "farmer",
  "farm_labourer",
  "artisan",
  "street_vendor",
  "domestic_worker",
  "construction",
  "driver",
  "gig_delivery",
  "shopkeeper",
  "salaried_private",
  "govt_employee",
  "student",
  "homemaker",
  "unemployed",
  "retired",
  "other",
]);
export const SectorType = z.enum(["Organised", "Unorganised"]);
export const RationCard = z.enum(["AAY", "BPL", "APL", "none"]);
export const IncomeBand = z.enum(["under_1L", "1L_to_2_5L", "2_5L_to_5L", "above_5L"]);
export const Housing = z.enum(["none", "kutcha", "semi_pucca", "pucca"]);

export const CitizenProfileSchema = z.object({
  state: z.string().nullable().default(null),
  district: z.string().nullable().default(null),
  village: z.string().nullable().default(null),
  areaType: AreaType.nullable().default(null),

  age: z.number().int().min(0).max(120).nullable().default(null),
  gender: Gender.nullable().default(null),
  maritalStatus: MaritalStatus.nullable().default(null),
  isWomanHeadOfHousehold: z.boolean().nullable().default(null),

  occupation: z.string().nullable().default(null),
  occupationClass: OccupationClass.nullable().default(null),
  sectorType: SectorType.nullable().default(null),
  artisanTrade: z.string().nullable().default(null),

  landAcres: z.number().min(0).nullable().default(null),
  isLandOwner: z.boolean().nullable().default(null),
  hasLandRecord: z.boolean().nullable().default(null),
  recentCropLoss: z.boolean().nullable().default(null),
  cropLossCause: z.string().nullable().default(null),

  annualIncomeBand: IncomeBand.nullable().default(null),
  rationCardType: RationCard.nullable().default(null),
  paysIncomeTax: z.boolean().nullable().default(null),
  govtEmployeeInFamily: z.boolean().nullable().default(null),
  hasEpfoOrEsic: z.boolean().nullable().default(null),

  householdMembers70Plus: z.number().int().min(0).nullable().default(null),
  hasDisability: z.boolean().nullable().default(null),
  housingType: Housing.nullable().default(null),

  aadhaarNameMatchesRationCard: z.boolean().nullable().default(null),
  aadhaarLinkedMobile: z.boolean().nullable().default(null),
  bankAccountAadhaarSeeded: z.boolean().nullable().default(null),
});

export type CitizenProfile = z.infer<typeof CitizenProfileSchema>;
export type ProfileKey = keyof CitizenProfile;

export const emptyProfile = (): CitizenProfile => CitizenProfileSchema.parse({});

export type FieldOrigin = "spoken" | "derived" | "asked" | "typed";
export type FieldEvidence = { field: ProfileKey; quote: string; origin: FieldOrigin; confidence: number };

export const AUDIT_FIELDS: ProfileKey[] = ["aadhaarNameMatchesRationCard", "aadhaarLinkedMobile", "bankAccountAadhaarSeeded"];

export const FIELD_LABELS: Record<ProfileKey, { label: string; plain: string }> = {
  state: { label: "State", plain: "which state" },
  district: { label: "District", plain: "district / zila" },
  village: { label: "Village / Town", plain: "gaon / ooru" },
  areaType: { label: "Area type", plain: "village or city" },
  age: { label: "Age", plain: "umar / vayassu" },
  gender: { label: "Gender", plain: "" },
  maritalStatus: { label: "Marital status", plain: "shaadi-shuda / vidhwa" },
  isWomanHeadOfHousehold: { label: "Woman head of household", plain: "ration card mein mukhiya kaun" },
  occupation: { label: "Occupation (own words)", plain: "kaam kya karte hain" },
  occupationClass: { label: "Occupation class", plain: "" },
  sectorType: { label: "Sector", plain: "organised / unorganised" },
  artisanTrade: { label: "Artisan trade", plain: "karigar kaam" },
  landAcres: { label: "Land (acres)", plain: "kitni zameen" },
  isLandOwner: { label: "Land owner", plain: "apni zameen ya kiraye ki" },
  hasLandRecord: { label: "Has land record (RTC / Pahani / Khatauni)", plain: "pahani / RTC hai" },
  recentCropLoss: { label: "Recent crop loss", plain: "fasal kharab" },
  cropLossCause: { label: "Crop loss cause", plain: "" },
  annualIncomeBand: { label: "Annual income", plain: "saal ki kamai" },
  rationCardType: { label: "Ration card type", plain: "ration card ka rang" },
  paysIncomeTax: { label: "Pays income tax", plain: "" },
  govtEmployeeInFamily: { label: "Govt employee in family", plain: "sarkari naukri ghar mein" },
  hasEpfoOrEsic: { label: "EPFO / ESIC member", plain: "PF katta hai" },
  householdMembers70Plus: { label: "Family members aged 70+", plain: "70 saal se upar koi" },
  hasDisability: { label: "Disability", plain: "" },
  housingType: { label: "House type", plain: "kachcha / pakka ghar" },
  aadhaarNameMatchesRationCard: { label: "Aadhaar name & DOB match ration card", plain: "" },
  aadhaarLinkedMobile: { label: "Mobile linked to Aadhaar", plain: "" },
  bankAccountAadhaarSeeded: { label: "Bank account Aadhaar-seeded (DBT)", plain: "" },
};

export const JARGON: Partial<Record<ProfileKey, Record<string, string>>> = {
  areaType: { Rural: "gaon / ooru -> Rural", Urban: "shahar / city -> Urban" },
  sectorType: { Unorganised: "no PF, no fixed employer -> Unorganised", Organised: "salaried with PF / ESIC -> Organised" },
  rationCardType: { AAY: "Antyodaya (yellow/pink)", BPL: "Below Poverty Line", APL: "Above Poverty Line", none: "No card" },
};

export function mergeProfile(base: CitizenProfile, delta: Partial<CitizenProfile>): CitizenProfile {
  const next: CitizenProfile = { ...base };
  for (const [k, v] of Object.entries(delta) as [ProfileKey, unknown][]) {
    if (v === undefined || v === null) continue;
    (next as Record<string, unknown>)[k] = v;
  }
  return derive(next);
}

export function derive(p: CitizenProfile): CitizenProfile {
  const next = { ...p };
  if (next.sectorType == null && next.occupationClass) {
    const organised: CitizenProfile["occupationClass"][] = ["salaried_private", "govt_employee"];
    if (organised.includes(next.occupationClass)) next.sectorType = "Organised";
    else if (!["student", "homemaker", "unemployed", "retired", "other"].includes(next.occupationClass)) next.sectorType = "Unorganised";
  }
  if (next.isLandOwner == null && next.landAcres != null && next.landAcres > 0) next.isLandOwner = true;
  if (next.govtEmployeeInFamily == null && next.occupationClass === "govt_employee") next.govtEmployeeInFamily = true;
  if (next.hasEpfoOrEsic == null && next.sectorType === "Organised") next.hasEpfoOrEsic = true;
  if (next.areaType == null && next.village) next.areaType = "Rural";
  return next;
}

export const acresToHectares = (acres: number) => Math.round(acres * 0.4047 * 100) / 100;
