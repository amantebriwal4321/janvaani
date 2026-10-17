import type { CitizenProfile, FieldEvidence, ProfileKey } from "../profile/schema";
import type { Lang } from "../models";

type Hit = { field: ProfileKey; value: unknown; quote: string; confidence: number };

const DEVANAGARI_DIGITS: Record<string, string> = { "०": "0", "१": "1", "२": "2", "३": "3", "४": "4", "५": "5", "६": "6", "७": "7", "८": "8", "९": "9" };
const KANNADA_DIGITS: Record<string, string> = { "೦": "0", "೧": "1", "೨": "2", "೩": "3", "೪": "4", "೫": "5", "೬": "6", "೭": "7", "೮": "8", "೯": "9" };

const WORD_NUMBERS: Record<string, number> = {
  ek: 1, do: 2, teen: 3, char: 4, paanch: 5, panch: 5, chhe: 6, saat: 7, aath: 8, nau: 9, das: 10, bees: 20, pachees: 25, tees: 30, pentees: 35, chalees: 40, pentalees: 45, pachas: 50, pachpan: 55, saath: 60, pensath: 65, sattar: 70, pachattar: 75, assi: 80,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80,
  "एक": 1, "दो": 2, "तीन": 3, "चार": 4, "पांच": 5, "पाँच": 5, "दस": 10, "बीस": 20, "तीस": 30, "चालीस": 40, "पचास": 50, "साठ": 60, "सत्तर": 70, "अस्सी": 80,
  "ಒಂದು": 1, "ಎರಡು": 2, "ಮೂರು": 3, "ನಾಲ್ಕು": 4, "ಐದು": 5, "ಹತ್ತು": 10,
};

function normalizeDigits(s: string) {
  return s.replace(/[०-९]/g, (d) => DEVANAGARI_DIGITS[d]).replace(/[೦-೯]/g, (d) => KANNADA_DIGITS[d]);
}

function num(token: string): number | null {
  const t = token.toLowerCase();
  if (/^\d+(\.\d+)?$/.test(t)) return parseFloat(t);
  return WORD_NUMBERS[t] ?? null;
}

export function detectLanguage(text: string): Lang {
  if (/[\u0C80-\u0CFF]/.test(text)) return "kn";
  if (/[\u0C00-\u0C7F]/.test(text)) return "te";
  if (/[\u0B80-\u0BFF]/.test(text)) return "ta";
  if (/[\u0900-\u097F]/.test(text)) return "hi";
  if (/\b(hoon|hai|hain|mera|meri|gaon|zameen|saal|kaam|karta|karti|nahi|haan)\b/i.test(text)) return "hi";
  return "en";
}

export function ruleExtract(textRaw: string): { delta: Partial<CitizenProfile>; evidence: FieldEvidence[] } {
  const text = normalizeDigits(textRaw);
  const lower = text.toLowerCase();
  const hits: Hit[] = [];
  const add = (field: ProfileKey, value: unknown, quote: string, confidence = 0.7) => hits.push({ field, value, quote, confidence });
  const grab = (re: RegExp) => { const m = text.match(re); return m ? m[0] : ""; };

  // age
  const ageRe = /(\d{1,3}|[a-zA-Z\u0900-\u097F\u0C80-\u0CFF]+)\s*(saal|sal|years?|yrs|वर्ष|साल|ವರ್ಷ|umar|age)/i;
  const ageM = text.match(ageRe);
  if (ageM) { const n = num(ageM[1]); if (n != null && n > 0 && n < 120) add("age", n, ageM[0], 0.8); }
  const ageM2 = text.match(/(umar|age|उम्र|ವಯಸ್ಸು)\s*(\d{1,3})/i);
  if (!ageM && ageM2) add("age", parseInt(ageM2[2], 10), ageM2[0], 0.8);

  // land
  const landM = text.match(/(\d+(\.\d+)?|[a-zA-Z\u0900-\u097F\u0C80-\u0CFF]+)\s*(acre|acres|ekad|ekar|एकड़|ಎಕರೆ|bigha|guntha|gunte|ಗುಂಟೆ)/i);
  if (landM) {
    const n = num(landM[1]);
    if (n != null) {
      const unit = landM[3].toLowerCase();
      const acres = /gunt|ಗುಂಟೆ/.test(unit) ? n / 40 : /bigha/.test(unit) ? n * 0.6 : n;
      add("landAcres", Math.round(acres * 100) / 100, landM[0], 0.8);
      add("isLandOwner", true, landM[0], 0.6);
    }
  }
  if (/\b(zameen|zamin|khet|kheti|land|farm|ಹೊಲ|ಜಮೀನು|खेत|ज़मीन|जमीन)\b/i.test(text) && !/\b(nahi|nahin|no|koi nahi|ಇಲ್ಲ|नहीं)\b/i.test(lower.slice(0, 80))) {
    if (!hits.some((h) => h.field === "isLandOwner")) add("isLandOwner", true, grab(/\b(zameen|khet|kheti|land|farm|ಹೊಲ|ಜಮೀನು|खेत|ज़मीन|जमीन)\b/i), 0.5);
  }
  if (/\b(kiraye|kiraya|lease|tenant|bataai|ಗುತ್ತಿಗೆ|किराये)\b/i.test(lower)) add("isLandOwner", false, grab(/\b(kiraye|kiraya|lease|tenant|bataai)\b/i), 0.7);

  // occupation
  const occ: [RegExp, CitizenProfile["occupationClass"], string][] = [
    [/\b(kisan|kheti|farmer|farming|ugata|ugati|ugate|fasal|crop|ರೈತ|ಬೇಸಾಯ|किसान|खेती|tamatar|dhaan|ragi|tomato)\b/i, "farmer", "farming"],
    [/\b(mazdoor|majdoor|labour|labor|coolie|daily wage|ಕೂಲಿ|मजदूर|dihadi)\b/i, "farm_labourer", "daily wage labour"],
    [/\b(darzi|tailor|badhai|carpenter|lohar|blacksmith|kumhar|potter|mochi|cobbler|sunar|goldsmith|nai|barber|dhobi|washerman|mistri|mason|raj mistri|ಟೈಲರ್|ದರ್ಜಿ|ಕುಂಬಾರ|ಬಡಗಿ|दर्जी|बढ़ई|लोहार|कुम्हार|मोची|सुनार|नाई|धोबी|मिस्त्री|weaver|bunkar|basket)\b/i, "artisan", "artisan trade"],
    [/\b(thela|rehdi|street vendor|hawker|sabzi bech|vendor|ಗಾಡಿ|ठेला|रेहड़ी|feri|pheri)\b/i, "street_vendor", "street vending"],
    [/\b(ghar ka kaam|maid|domestic|housekeeping|bartan|jhadu|ಮನೆಗೆಲಸ|घर का काम|कामवाली)\b/i, "domestic_worker", "domestic work"],
    [/\b(construction|building site|site pe|beldar|ಕಟ್ಟಡ|निर्माण)\b/i, "construction", "construction work"],
    [/\b(driver|auto chalata|auto chalati|rickshaw|cab|truck|ಡ್ರೈವರ್|ड्राइवर|ऑटो)\b/i, "driver", "driving"],
    [/\b(delivery|swiggy|zomato|zepto|blinkit|amazon|gig)\b/i, "gig_delivery", "delivery work"],
    [/\b(dukaan|dukan|shop|kirana|ಅಂಗಡಿ|दुकान)\b/i, "shopkeeper", "shopkeeper"],
    [/\b(sarkari naukri|government job|govt job|teacher in government|ಸರ್ಕಾರಿ ಕೆಲಸ|सरकारी नौकरी)\b/i, "govt_employee", "government job"],
    [/\b(company|office|private job|software|it job|salary|ಕಂಪನಿ|कंपनी|नौकरी)\b/i, "salaried_private", "private salaried job"],
    [/\b(student|padhai|padhta|padhti|college|ವಿದ್ಯಾರ್ಥಿ|छात्र|पढ़ाई)\b/i, "student", "student"],
    [/\b(housewife|homemaker|grihini|ಗೃಹಿಣಿ|गृहिणी)\b/i, "homemaker", "homemaker"],
    [/\b(retired|pension|ನಿವೃತ್ತ|सेवानिवृत्त)\b/i, "retired", "retired"],
  ];
  for (const [re, cls, plain] of occ) {
    const m = text.match(re);
    if (m) { add("occupationClass", cls, m[0], 0.75); add("occupation", plain, m[0], 0.6); if (cls === "artisan") add("artisanTrade", m[0], m[0], 0.6); break; }
  }

  // location
  const villageM = text.match(/([A-Za-z\u0900-\u097F\u0C80-\u0CFF]+)\s*(gaon|gaav|village|ಹಳ್ಳಿ|ಊರು|ಗ್ರಾಮ|गाँव|गांव|ग्राम)/i);
  if (villageM) { add("village", villageM[1], villageM[0], 0.6); add("areaType", "Rural", villageM[0], 0.8); }
  else if (/\b(gaon|gaav|village|ಹಳ್ಳಿ|ಊರು|ಗ್ರಾಮ|गाँव|गांव|ग्राम|dehat|ಹಳ್ಳಿಯ)\b/i.test(text)) add("areaType", "Rural", grab(/\b(gaon|gaav|village|ಹಳ್ಳಿ|ಊರು|ಗ್ರಾಮ|गाँव|गांव|ग्राम)\b/i), 0.8);
  if (/\b(shahar|sheher|city|town|bangalore|bengaluru|mysore|mysuru|hubli|mangalore|ಬೆಂಗಳೂರು|ನಗರ|शहर)\b/i.test(text) && !hits.some((h) => h.field === "areaType")) add("areaType", "Urban", grab(/\b(shahar|sheher|city|town|bangalore|bengaluru|ನಗರ|शहर)\b/i), 0.7);
  const districts = ["Kolar", "Tumkur", "Tumakuru", "Mandya", "Mysuru", "Mysore", "Hassan", "Chikkaballapur", "Ramanagara", "Belagavi", "Belgaum", "Dharwad", "Hubli", "Ballari", "Bellary", "Raichur", "Kalaburagi", "Gulbarga", "Bidar", "Vijayapura", "Bijapur", "Bagalkot", "Davanagere", "Shivamogga", "Shimoga", "Chitradurga", "Udupi", "Dakshina Kannada", "Mangaluru", "Uttara Kannada", "Chikkamagaluru", "Kodagu", "Haveri", "Gadag", "Koppal", "Yadgir", "Chamarajanagar", "Bengaluru Rural", "Bengaluru Urban", "Bangalore"];
  for (const d of districts) {
    const re = new RegExp(`\\b${d}\\b`, "i");
    if (re.test(text)) { add("district", d, grab(re), 0.7); add("state", "Karnataka", grab(re), 0.6); break; }
  }
  if (/\b(karnataka|ಕರ್ನಾಟಕ|कर्नाटक)\b/i.test(text)) add("state", "Karnataka", grab(/\b(karnataka|ಕರ್ನಾಟಕ|कर्नाटक)\b/i), 0.9);

  // household
  const seniorM = text.match(/(\d{2})\s*(saal|years?|वर्ष|साल|ವರ್ಷ)[^.]{0,30}(pitaji|papa|father|maa|mother|amma|appa|ajji|dadi|dada|nani|nana|sasur|saas|ತಂದೆ|ತಾಯಿ|पिता|माँ|मां|माता)/i);
  if (seniorM && parseInt(seniorM[1], 10) >= 70) add("householdMembers70Plus", 1, seniorM[0], 0.7);
  if (/\b(vidhwa|widow|pati nahi rahe|pati ka dehant|husband died|husband passed|ವಿಧವೆ|ಗಂಡ ತೀರಿ|विधवा|पति नहीं रहे)\b/i.test(text)) { add("maritalStatus", "widowed", grab(/\b(vidhwa|widow|pati nahi rahe|husband died|ವಿಧವೆ|विधवा)\b/i), 0.8); add("gender", "female", "", 0.6); }
  if (/\b(shaadi\s*shuda|married|pati|patni|wife|husband|ಹೆಂಡತಿ|ಗಂಡ|पत्नी|पति)\b/i.test(text) && !hits.some((h) => h.field === "maritalStatus")) add("maritalStatus", "married", grab(/\b(shaadi\s*shuda|married|pati|patni|wife|husband)\b/i), 0.6);
  if (/\b(main aurat|mahila|woman|female|ಮಹಿಳೆ|महिला|औरत)\b/i.test(text)) add("gender", "female", grab(/\b(mahila|woman|female|ಮಹಿಳೆ|महिला|औरत)\b/i), 0.6);

  // ration card
  if (/\b(aay|antyodaya|antodaya|pink card|yellow card|ಅಂತ್ಯೋದಯ|अंत्योदय)\b/i.test(text)) add("rationCardType", "AAY", grab(/\b(aay|antyodaya|antodaya|pink card|yellow card)\b/i), 0.8);
  else if (/\b(bpl|garibi rekha|below poverty|ಬಿಪಿಎಲ್|बीपीएल)\b/i.test(text)) add("rationCardType", "BPL", grab(/\b(bpl|garibi rekha|below poverty|ಬಿಪಿಎಲ್|बीपीएल)\b/i), 0.8);
  else if (/\b(apl|ಎಪಿಎಲ್|एपीएल)\b/i.test(text)) add("rationCardType", "APL", grab(/\b(apl)\b/i), 0.8);
  else if (/ration card (nahi|nahin|नहीं)|no ration card|ರೇಷನ್ ಕಾರ್ಡ್ ಇಲ್ಲ/i.test(text)) add("rationCardType", "none", grab(/ration card (nahi|nahin)|no ration card/i), 0.8);

  // housing
  if (/\b(kachcha|kaccha|kutcha|mitti ka ghar|jhopdi|hut|ಗುಡಿಸಲು|कच्चा|झोपड़ी)\b/i.test(text)) add("housingType", "kutcha", grab(/\b(kachcha|kaccha|kutcha|jhopdi|hut|ಗುಡಿಸಲು|कच्चा)\b/i), 0.8);
  else if (/\b(pakka|pucca|pakka ghar|cement house|ಪಕ್ಕಾ|पक्का)\b/i.test(text)) add("housingType", "pucca", grab(/\b(pakka|pucca|ಪಕ್ಕಾ|पक्का)\b/i), 0.8);
  else if (/\b(ghar nahi|homeless|no house|ಮನೆ ಇಲ್ಲ|घर नहीं)\b/i.test(text)) add("housingType", "none", grab(/\b(ghar nahi|homeless|no house)\b/i), 0.8);

  // crop loss
  if (/\b(fasal (kharab|barbad|nasht)|crop (loss|damage|fail)|baarish se|barish se|sookha|drought|ಬೆಳೆ (ಹಾನಿ|ನಷ್ಟ)|फसल (खराब|बर्बाद)|hailstorm|ole|flood|baadh)\b/i.test(text)) {
    const q = grab(/\b(fasal (kharab|barbad)|crop (loss|damage)|baarish|barish|sookha|drought|ಬೆಳೆ ಹಾನಿ|फसल खराब|flood|baadh|ole)\b/i);
    add("recentCropLoss", true, q, 0.8);
    const cause = /baarish|barish|rain|flood|baadh|ಮಳೆ|बारिश/i.test(text) ? "unseasonal rain / flood" : /sookha|drought|ಬರ|सूखा/i.test(text) ? "drought" : /ole|hail/i.test(text) ? "hailstorm" : /keeda|pest|rog|ಕೀಟ|कीड़ा/i.test(text) ? "pest / disease" : null;
    if (cause) add("cropLossCause", cause, q, 0.7);
  }

  // tax / pf / govt
  if (/\b(income tax|tax bharta|tax deta|ಆದಾಯ ತೆರಿಗೆ|आयकर)\b/i.test(text)) add("paysIncomeTax", !/\b(nahi|nahin|no|ಇಲ್ಲ|नहीं)\b/i.test(text), grab(/\b(income tax|tax bharta|ಆದಾಯ ತೆರಿಗೆ|आयकर)\b/i), 0.7);
  if (/\b(pf|epfo|esic|provident)\b/i.test(text)) add("hasEpfoOrEsic", !/\b(nahi|nahin|no|ಇಲ್ಲ|नहीं)\b/i.test(text), grab(/\b(pf|epfo|esic|provident)\b/i), 0.7);

  // income
  const incM = text.match(/(\d+(\.\d+)?)\s*(lakh|lac|लाख|ಲಕ್ಷ)/i);
  if (incM) {
    const l = parseFloat(incM[1]);
    add("annualIncomeBand", l < 1 ? "under_1L" : l <= 2.5 ? "1L_to_2_5L" : l <= 5 ? "2_5L_to_5L" : "above_5L", incM[0], 0.6);
  }
  const monthlyM = text.match(/(\d{3,6})\s*(rupay|rupees|rs|₹|ರೂ|रुपये)?\s*(mahina|mahine|month|per month|ತಿಂಗಳ|महीना|महीने)/i);
  if (monthlyM) {
    const yearly = parseInt(monthlyM[1], 10) * 12;
    add("annualIncomeBand", yearly < 100000 ? "under_1L" : yearly <= 250000 ? "1L_to_2_5L" : yearly <= 500000 ? "2_5L_to_5L" : "above_5L", monthlyM[0], 0.6);
  }

  // yes/no for audit style answers handled by caller via pending field

  const delta: Partial<CitizenProfile> = {};
  const evidence: FieldEvidence[] = [];
  for (const h of hits) {
    if ((delta as Record<string, unknown>)[h.field] !== undefined) continue;
    (delta as Record<string, unknown>)[h.field] = h.value;
    evidence.push({ field: h.field, quote: h.quote, origin: "spoken", confidence: h.confidence });
  }
  return { delta, evidence };
}

export function parseYesNo(text: string): boolean | null {
  const t = text.toLowerCase();
  if (/\b(haan|ha|han|ji haan|yes|yeah|sahi|same|match|hai|ಹೌದು|हाँ|हां|जी|avunu|aamam)\b/.test(t) && !/\b(nahi|nahin|no|not|ಇಲ್ಲ|नहीं|alag|different|mismatch)\b/.test(t)) return true;
  if (/\b(nahi|nahin|no|not|ಇಲ್ಲ|नहीं|alag|different|mismatch|galat|pata nahi)\b/.test(t)) return false;
  return null;
}
