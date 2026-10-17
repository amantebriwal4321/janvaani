import { z } from "zod";
import type { CitizenProfile } from "./fields";

// Runtime validation for request bodies and LLM output (server only). Browser
// code must import from ./fields instead so zod stays out of the client bundle.
export * from "./fields";

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

// Fails to compile if the zod schema and the plain CitizenProfile type in
// ./fields drift apart in either direction.
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const _schemaMatchesType: Equal<z.infer<typeof CitizenProfileSchema>, CitizenProfile> = true;
void _schemaMatchesType;
