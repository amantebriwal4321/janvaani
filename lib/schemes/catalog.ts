import type { CitizenProfile, ProfileKey } from "../profile/schema";

export type Verdict = "eligible" | "likely" | "blocked" | "unknown";

export type RuleResult = {
  verdict: Verdict;
  reasons: string[];
  missing: ProfileKey[];
};

export type Scheme = {
  id: string;
  name: string;
  nativeName: string;
  level: "Central" | "Karnataka";
  benefit: string;
  category: "health" | "income" | "insurance" | "social_security" | "housing" | "pension";
  documents: string[];
  applyAt: string[];
  portal: string;
  rule: (p: CitizenProfile) => RuleResult;
};

const need = (p: CitizenProfile, keys: ProfileKey[]) => keys.filter((k) => p[k] == null);

export const SCHEMES: Scheme[] = [
  {
    id: "pmjay",
    name: "Ayushman Bharat PM-JAY",
    nativeName: "आयुष्मान भारत / ಆಯುಷ್ಮಾನ್ ಭಾರತ",
    level: "Central",
    benefit: "Rs 5 lakh per family per year cashless hospital cover",
    category: "health",
    documents: ["Aadhaar card", "Ration card (family)", "Mobile phone linked to Aadhaar (OTP)"],
    applyAt: ["Any CSC / Pragya Kendra (e-KYC + card print)", "Arogya Mitra desk at an empanelled hospital", "Helpline 14555", "beneficiary.nha.gov.in self-service"],
    portal: "https://beneficiary.nha.gov.in",
    rule: (p) => {
      const missing = need(p, ["rationCardType", "areaType"]);
      const reasons: string[] = [];
      if (p.rationCardType === "AAY" || p.rationCardType === "BPL") {
        reasons.push(`${p.rationCardType} ration card families are in the PM-JAY target list (SECC deprivation / priority household)`);
        return { verdict: "eligible", reasons, missing: [] };
      }
      if (p.paysIncomeTax === true || p.govtEmployeeInFamily === true) {
        return { verdict: "blocked", reasons: ["Income-tax payers and government-employee families are excluded"], missing: [] };
      }
      if (p.areaType === "Rural" && (p.housingType === "kutcha" || p.housingType === "none")) {
        reasons.push("Rural household with kutcha / no house matches SECC deprivation criterion D1");
        return { verdict: "likely", reasons, missing };
      }
      if (p.occupationClass && ["farm_labourer", "domestic_worker", "street_vendor", "construction"].includes(p.occupationClass)) {
        reasons.push("Manual casual labour / domestic work / street vending are SECC deprivation and urban occupational categories");
        return { verdict: "likely", reasons, missing };
      }
      if (p.rationCardType === "APL") return { verdict: "blocked", reasons: ["APL card alone does not qualify; eligibility is from the SECC 2011 list, check name at 14555"], missing: [] };
      return { verdict: "unknown", reasons: ["Depends on the SECC 2011 list or ration card type"], missing };
    },
  },
  {
    id: "vay_vandana",
    name: "Ayushman Vay Vandana (70+)",
    nativeName: "आयुष्मान वय वंदना कार्ड",
    level: "Central",
    benefit: "Rs 5 lakh health cover for every citizen aged 70 or more, no income test",
    category: "health",
    documents: ["Aadhaar card of the senior (age proof)", "Mobile linked to Aadhaar"],
    applyAt: ["Ayushman app self-enrolment", "CSC", "Empanelled hospital Arogya Mitra"],
    portal: "https://beneficiary.nha.gov.in",
    rule: (p) => {
      if ((p.age ?? 0) >= 70) return { verdict: "eligible", reasons: ["Age 70 or above: universal cover, no income or category condition"], missing: [] };
      if ((p.householdMembers70Plus ?? 0) > 0) return { verdict: "eligible", reasons: [`${p.householdMembers70Plus} family member(s) aged 70+ qualify for their own card`], missing: [] };
      const missing = need(p, ["age", "householdMembers70Plus"]);
      if (missing.length) return { verdict: "unknown", reasons: ["Need ages of senior family members"], missing };
      return { verdict: "blocked", reasons: ["No family member aged 70 or above"], missing: [] };
    },
  },
  {
    id: "pm_kisan",
    name: "PM-KISAN Samman Nidhi",
    nativeName: "पीएम किसान / ಪಿಎಂ ಕಿಸಾನ್",
    level: "Central",
    benefit: "Rs 6,000 per year in three instalments to the landholding farmer family",
    category: "income",
    documents: ["Aadhaar card", "Land record (RTC / Pahani / Khatauni) in the applicant's name", "Bank passbook (Aadhaar-seeded for DBT)", "Aadhaar-linked mobile"],
    applyAt: ["pmkisan.gov.in -> New Farmer Registration", "CSC", "Village Accountant / Raitha Samparka Kendra for land verification"],
    portal: "https://pmkisan.gov.in",
    rule: (p) => {
      const missing = need(p, ["isLandOwner", "paysIncomeTax", "govtEmployeeInFamily"]);
      if (p.isLandOwner === false) return { verdict: "blocked", reasons: ["Only landholding farmer families qualify; tenant farmers are not covered"], missing: [] };
      if (p.paysIncomeTax === true) return { verdict: "blocked", reasons: ["Income-tax payers in the last assessment year are excluded"], missing: [] };
      if (p.govtEmployeeInFamily === true) return { verdict: "blocked", reasons: ["Families with a serving or retired government employee are excluded"], missing: [] };
      if (p.isLandOwner === true || (p.landAcres ?? 0) > 0) {
        const reasons = [`Cultivable land ${p.landAcres != null ? `(${p.landAcres} acres) ` : ""}in the family's name`];
        if (p.hasLandRecord === false) reasons.push("Land record must be updated to the applicant's name first");
        return { verdict: missing.length ? "likely" : "eligible", reasons, missing };
      }
      return { verdict: "unknown", reasons: ["Need to know if the family owns farmland"], missing: need(p, ["landAcres", "isLandOwner"]) };
    },
  },
  {
    id: "pmfby",
    name: "PM Fasal Bima Yojana (crop insurance claim)",
    nativeName: "फसल बीमा / ಬೆಳೆ ವಿಮೆ",
    level: "Central",
    benefit: "Compensation for crop loss from rain, drought, pests; localised loss must be reported within 72 hours",
    category: "insurance",
    documents: ["Land record (RTC / Pahani)", "Sowing certificate or crop declaration", "Bank passbook", "Aadhaar", "Photos of the damaged field if possible"],
    applyAt: ["Crop Insurance app (report loss within 72 h)", "Toll-free 14447", "Bank branch where the crop loan is", "Raitha Samparka Kendra / Agriculture officer"],
    portal: "https://pmfby.gov.in",
    rule: (p) => {
      if (p.recentCropLoss === true) {
        const reasons = [`Recent crop loss reported${p.cropLossCause ? ` (${p.cropLossCause})` : ""}; intimation must reach the insurer within 72 hours`];
        return { verdict: (p.landAcres ?? 0) > 0 || p.isLandOwner ? "eligible" : "likely", reasons, missing: need(p, ["landAcres"]) };
      }
      if (p.occupationClass === "farmer" && p.recentCropLoss == null) return { verdict: "unknown", reasons: ["Ask whether any crop was damaged this season"], missing: ["recentCropLoss"] };
      return { verdict: "blocked", reasons: ["No crop loss to claim right now"], missing: [] };
    },
  },
  {
    id: "eshram",
    name: "e-Shram card",
    nativeName: "ई-श्रम कार्ड",
    level: "Central",
    benefit: "National database for unorganised workers: Rs 2 lakh accident insurance (PMSBY) and access to welfare schemes",
    category: "social_security",
    documents: ["Aadhaar card", "Aadhaar-linked mobile (OTP)", "Bank account number + IFSC"],
    applyAt: ["eshram.gov.in self-registration", "CSC", "State Seva Kendra"],
    portal: "https://eshram.gov.in",
    rule: (p) => {
      const missing = need(p, ["age", "sectorType", "hasEpfoOrEsic", "paysIncomeTax"]);
      if (p.sectorType === "Organised" || p.hasEpfoOrEsic === true) return { verdict: "blocked", reasons: ["EPFO / ESIC members and organised-sector workers are not covered"], missing: [] };
      if (p.paysIncomeTax === true) return { verdict: "blocked", reasons: ["Income-tax payers are excluded"], missing: [] };
      if (p.age != null && (p.age < 16 || p.age > 59)) return { verdict: "blocked", reasons: ["Age must be 16 to 59"], missing: [] };
      if (p.sectorType === "Unorganised") {
        return { verdict: missing.length ? "likely" : "eligible", reasons: [`${p.occupation ?? p.occupationClass ?? "This work"} counts as unorganised-sector work`], missing };
      }
      return { verdict: "unknown", reasons: ["Need the kind of work and age"], missing: need(p, ["occupationClass", "age"]) };
    },
  },
  {
    id: "vishwakarma",
    name: "PM Vishwakarma",
    nativeName: "पीएम विश्वकर्मा",
    level: "Central",
    benefit: "Rs 15,000 toolkit voucher, skill training with stipend, collateral-free loan up to Rs 3 lakh for 18 traditional trades",
    category: "income",
    documents: ["Aadhaar", "Aadhaar-linked mobile", "Bank passbook", "Ration card (family check)"],
    applyAt: ["CSC only (biometric Aadhaar verification by the VLE)", "Gram Panchayat verification afterwards"],
    portal: "https://pmvishwakarma.gov.in",
    rule: (p) => {
      if (p.occupationClass === "artisan") {
        if (p.govtEmployeeInFamily === true) return { verdict: "blocked", reasons: ["Families with a government employee are excluded"], missing: [] };
        if ((p.age ?? 18) < 18) return { verdict: "blocked", reasons: ["Minimum age 18"], missing: [] };
        return { verdict: "eligible", reasons: [`${p.artisanTrade ?? "Traditional artisan trade"} is one of the 18 Vishwakarma trades (carpenter, tailor, potter, blacksmith, cobbler, mason, barber, washerman, goldsmith, etc.)`], missing: need(p, ["govtEmployeeInFamily"]) };
      }
      return { verdict: "blocked", reasons: ["Only hand-and-tool artisan trades qualify"], missing: [] };
    },
  },
  {
    id: "pmay_g",
    name: "PM Awas Yojana - Gramin",
    nativeName: "पीएम आवास / ಪಿಎಂ ಆವಾಸ್",
    level: "Central",
    benefit: "Rs 1.2 lakh assistance (plus MGNREGA wages and toilet) to build a pucca house",
    category: "housing",
    documents: ["Aadhaar", "Job card (MGNREGA) if any", "Bank passbook", "Self-declaration of no pucca house"],
    applyAt: ["Gram Panchayat (Awaas+ 2024 survey list)", "Awaas+ app self-survey with Aadhaar face auth"],
    portal: "https://pmayg.nic.in",
    rule: (p) => {
      if (p.areaType === "Urban") return { verdict: "blocked", reasons: ["Rural scheme; urban households use PMAY-Urban"], missing: [] };
      if (p.housingType === "kutcha" || p.housingType === "none") return { verdict: "eligible", reasons: ["Houseless or kutcha-house households are the target group"], missing: need(p, ["areaType"]) };
      if (p.housingType === "pucca") return { verdict: "blocked", reasons: ["Already owns a pucca house"], missing: [] };
      return { verdict: "unknown", reasons: ["Need the type of house the family lives in"], missing: ["housingType"] };
    },
  },
  {
    id: "old_age_pension",
    name: "Old age pension (IGNOAPS / Sandhya Suraksha)",
    nativeName: "वृद्धावस्था पेंशन / ಸಂಧ್ಯಾ ಸುರಕ್ಷಾ",
    level: "Karnataka",
    benefit: "Rs 1,200 per month (Karnataka Sandhya Suraksha, 65+) or central IGNOAPS (60+, BPL)",
    category: "pension",
    documents: ["Aadhaar", "Age proof", "BPL / income certificate", "Bank passbook"],
    applyAt: ["Seva Sindhu portal", "Nadakacheri / Taluk office", "Gram Panchayat"],
    portal: "https://sevasindhu.karnataka.gov.in",
    rule: (p) => {
      if (p.age == null) return { verdict: "unknown", reasons: ["Need the applicant's age"], missing: ["age"] };
      if (p.age >= 65) {
        if (p.annualIncomeBand === "above_5L" || p.paysIncomeTax === true) return { verdict: "blocked", reasons: ["Income above the pension ceiling"], missing: [] };
        return { verdict: "eligible", reasons: ["Age 65+ with low income qualifies for Sandhya Suraksha (Karnataka)"], missing: need(p, ["annualIncomeBand"]) };
      }
      if (p.age >= 60 && (p.rationCardType === "BPL" || p.rationCardType === "AAY")) return { verdict: "eligible", reasons: ["Age 60+ with BPL card qualifies for IGNOAPS"], missing: [] };
      if (p.age >= 60) return { verdict: "likely", reasons: ["Age 60+; needs BPL card for IGNOAPS"], missing: need(p, ["rationCardType"]) };
      return { verdict: "blocked", reasons: ["Below pension age"], missing: [] };
    },
  },
  {
    id: "gruha_lakshmi",
    name: "Gruha Lakshmi",
    nativeName: "ಗೃಹ ಲಕ್ಷ್ಮಿ / गृह लक्ष्मी",
    level: "Karnataka",
    benefit: "Rs 2,000 per month to the woman head of household named on the ration card",
    category: "income",
    documents: ["Ration card showing the woman as head", "Aadhaar of the woman", "Bank passbook (Aadhaar-seeded)", "Aadhaar-linked mobile"],
    applyAt: ["Grama One / Bapuji Seva Kendra", "Karnataka One / Bangalore One", "Seva Sindhu Guarantee portal"],
    portal: "https://sevasindhugs.karnataka.gov.in",
    rule: (p) => {
      if (p.state && !/karnataka/i.test(p.state)) return { verdict: "blocked", reasons: ["Karnataka residents only"], missing: [] };
      if (p.gender === "male" && p.isWomanHeadOfHousehold !== true) return { verdict: "likely", reasons: ["The woman head of the household on the ration card (wife / mother) can apply"], missing: need(p, ["isWomanHeadOfHousehold"]) };
      if (p.paysIncomeTax === true) return { verdict: "blocked", reasons: ["Income-tax or GST filers are excluded"], missing: [] };
      if (p.isWomanHeadOfHousehold === true) return { verdict: "eligible", reasons: ["Woman head of household on the ration card"], missing: need(p, ["rationCardType"]) };
      return { verdict: "unknown", reasons: ["Need to know who is listed as head on the ration card"], missing: ["isWomanHeadOfHousehold"] };
    },
  },
  {
    id: "widow_pension",
    name: "Vidhava Vetana (widow pension)",
    nativeName: "विधवा पेंशन / ವಿಧವಾ ವೇತನ",
    level: "Karnataka",
    benefit: "Rs 800 per month to widows (IGNWPS central share for BPL widows 40-79)",
    category: "pension",
    documents: ["Husband's death certificate", "Aadhaar", "BPL / income certificate", "Bank passbook"],
    applyAt: ["Nadakacheri / Taluk office", "Seva Sindhu", "Gram Panchayat"],
    portal: "https://sevasindhu.karnataka.gov.in",
    rule: (p) => {
      if (p.maritalStatus === "widowed") {
        if (p.annualIncomeBand === "above_5L") return { verdict: "blocked", reasons: ["Income above ceiling"], missing: [] };
        return { verdict: "eligible", reasons: ["Widow with low income qualifies"], missing: need(p, ["annualIncomeBand"]) };
      }
      if (p.maritalStatus == null) return { verdict: "unknown", reasons: [], missing: ["maritalStatus"] };
      return { verdict: "blocked", reasons: ["Only widows qualify"], missing: [] };
    },
  },
];

export const schemeById = (id: string) => SCHEMES.find((s) => s.id === id);
