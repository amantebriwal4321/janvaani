// Plain-TypeScript view of the citizen profile: types, labels and pure
// helpers with no runtime dependencies. Client components import from here so
// zod stays out of the browser bundle; the zod schema in ./schema.ts validates
// request bodies on the server and re-exports everything below.

export type AreaType = "Rural" | "Urban";
export type Gender = "female" | "male" | "other";
export type MaritalStatus = "married" | "unmarried" | "widowed" | "divorced" | "separated";
export type OccupationClass =
  | "farmer"
  | "farm_labourer"
  | "artisan"
  | "street_vendor"
  | "domestic_worker"
  | "construction"
  | "driver"
  | "gig_delivery"
  | "shopkeeper"
  | "salaried_private"
  | "govt_employee"
  | "student"
  | "homemaker"
  | "unemployed"
  | "retired"
  | "other";
export type SectorType = "Organised" | "Unorganised";
export type RationCard = "AAY" | "BPL" | "APL" | "none";
export type IncomeBand = "under_1L" | "1L_to_2_5L" | "2_5L_to_5L" | "above_5L";
export type Housing = "none" | "kutcha" | "semi_pucca" | "pucca";

export type CitizenProfile = {
  state: string | null;
  district: string | null;
  village: string | null;
  areaType: AreaType | null;

  age: number | null;
  gender: Gender | null;
  maritalStatus: MaritalStatus | null;
  isWomanHeadOfHousehold: boolean | null;

  occupation: string | null;
  occupationClass: OccupationClass | null;
  sectorType: SectorType | null;
  artisanTrade: string | null;

  landAcres: number | null;
  isLandOwner: boolean | null;
  hasLandRecord: boolean | null;
  recentCropLoss: boolean | null;
  cropLossCause: string | null;

  annualIncomeBand: IncomeBand | null;
  rationCardType: RationCard | null;
  paysIncomeTax: boolean | null;
  govtEmployeeInFamily: boolean | null;
  hasEpfoOrEsic: boolean | null;

  householdMembers70Plus: number | null;
  hasDisability: boolean | null;
  housingType: Housing | null;

  aadhaarNameMatchesRationCard: boolean | null;
  aadhaarLinkedMobile: boolean | null;
  bankAccountAadhaarSeeded: boolean | null;
};

export type ProfileKey = keyof CitizenProfile;

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

// FIELD_LABELS is keyed by every ProfileKey, so it doubles as the canonical key list.
export const PROFILE_KEYS = Object.keys(FIELD_LABELS) as ProfileKey[];

export const emptyProfile = (): CitizenProfile =>
  Object.fromEntries(PROFILE_KEYS.map((k) => [k, null])) as Record<ProfileKey, null> as CitizenProfile;

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
