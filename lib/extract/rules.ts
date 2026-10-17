import type { CitizenProfile, FieldEvidence, ProfileKey } from "../profile/schema";
import type { Lang } from "../models";

// JS \b only understands ASCII word characters, so Devanagari / Kannada /
// Telugu tokens never hit a boundary. rx() rewrites \b to Unicode-aware
// lookarounds and turns on the u flag.
function rx(source: string, flags = ""): RegExp {
  const src = source.replace(/\\b/g, "(?:(?<![\\p{L}\\p{N}])|(?![\\p{L}\\p{N}]))");
  return new RegExp(src, flags.includes("u") ? flags : flags + "u");
}

type Hit = { field: ProfileKey; value: unknown; quote: string; confidence: number };

// Letters of every script the extractor understands (Latin, Devanagari, Telugu, Tamil, Kannada).
const WORD = "A-Za-z\\u0900-\\u097F\\u0B80-\\u0BFF\\u0C00-\\u0C7F\\u0C80-\\u0CFF";

const VILLAGE_STOP = new Set(["ek", "kisi", "mere", "mera", "apne", "hamare", "chhote", "chote", "bade", "a", "my", "our", "the", "small", "se", "ke", "paas", "ki", "ka", "wale", "ek", "एक", "मेरे", "अपने", "छोटे", "ಒಂದು", "ನಮ್ಮ", "ನನ್ನ", "ಚಿಕ್ಕ", "ಹಳ್ಳಿ", "మా", "మన", "నా", "ఒక", "చిన్న", "మాది", "எங்கள்", "என்", "ஒரு"]);

// canonical, then aliases in Latin / Kannada / Hindi / Telugu / Tamil. Indic forms are stems so inflections match.
const DISTRICTS: string[][] = [
  ["Kolar", "ಕೋಲಾರ", "कोलार", "కోలార", "கோலார்"],
  ["Tumakuru", "Tumkur", "ತುಮಕೂರ", "तुमकुर", "तुमकूरु", "తుమకూరు", "తుమకూర్", "தும்கூர்"],
  ["Mandya", "ಮಂಡ್ಯ", "मांड्या", "मंड्या", "మండ్య", "மண்டியா"],
  ["Mysuru", "Mysore", "ಮೈಸೂರ", "मैसूर", "मैसूरु", "మైసూర", "மைசூர"],
  ["Hassan", "ಹಾಸನ", "हासन", "హాసన"],
  ["Chikkaballapur", "ಚಿಕ್ಕಬಳ್ಳಾಪುರ", "चिक्कबल्लापुर", "చిక్కబళ్ళాపూర", "చిక్కబళ్లాపూర"],
  ["Ramanagara", "ರಾಮನಗರ", "रामनगर", "రామనగర", "ராமநகர"],
  ["Belagavi", "Belgaum", "ಬೆಳಗಾವಿ", "बेलगाम", "बेलगावी", "బెళగావి", "బెల్గాం"],
  ["Dharwad", "Hubli", "ಧಾರವಾಡ", "ಹುಬ್ಬಳ್ಳಿ", "धारवाड़", "हुबली", "ధార్వాడ", "హుబ్లీ"],
  ["Ballari", "Bellary", "ಬಳ್ಳಾರಿ", "बल्लारी", "बेल्लारी", "బళ్ళారి", "బళ్లారి", "బెల్లారి"],
  ["Raichur", "ರಾಯಚೂರ", "रायचूर", "రాయచూర"],
  ["Kalaburagi", "Gulbarga", "ಕಲಬುರಗಿ", "गुलबर्गा", "कलबुर्गी", "కలబురగి", "గుల్బర్గా"],
  ["Bidar", "ಬೀದರ", "बीदर", "బీదర"],
  ["Vijayapura", "Bijapur", "ವಿಜಯಪುರ", "बीजापुर", "विजयपुरा", "విజయపుర", "బీజాపూర"],
  ["Bagalkot", "ಬಾಗಲಕೋಟೆ", "बागलकोट", "బాగల్కోట"],
  ["Davanagere", "ದಾವಣಗೆರೆ", "दावणगेरे", "దావణగెరె"],
  ["Shivamogga", "Shimoga", "ಶಿವಮೊಗ್ಗ", "शिवमोग्गा", "శివమొగ్గ"],
  ["Chitradurga", "ಚಿತ್ರದುರ್ಗ", "चित्रदुर्ग", "చిత్రదుర్గ"],
  ["Udupi", "ಉಡುಪಿ", "उडुपी", "ఉడుపి"],
  ["Dakshina Kannada", "Mangaluru", "Mangalore", "ಮಂಗಳೂರ", "मंगलूरु", "మంగళూరు"],
  ["Uttara Kannada", "Karwar", "ಕಾರವಾರ", "कारवार", "కార్వార"],
  ["Chikkamagaluru", "Chikmagalur", "ಚಿಕ್ಕಮಗಳೂರ", "चिक्कमगलूरु", "చిక్కమగళూరు"],
  ["Kodagu", "Coorg", "ಕೊಡಗ", "कोडगु", "కొడగు"],
  ["Haveri", "ಹಾವೇರಿ", "हावेरी", "హావేరి"],
  ["Gadag", "ಗದಗ", "गदग", "గదగ"],
  ["Koppal", "ಕೊಪ್ಪಳ", "कोप्पल", "కొప్పళ"],
  ["Yadgir", "ಯಾದಗಿರಿ", "यादगिर", "యాదగిరి"],
  ["Chamarajanagar", "ಚಾಮರಾಜನಗರ", "चामराजनगर", "చామరాజనగర", "சாமராஜநகர"],
  ["Bengaluru Rural", "Bangalore Rural"],
  ["Bengaluru Urban", "Bengaluru", "Bangalore", "ಬೆಂಗಳೂರ", "बैंगलोर", "बेंगलुरु", "बंगलौर", "బెంగళూరు", "బెంగుళూరు", "பெங்களூர"],
];

const DEVANAGARI_DIGITS: Record<string, string> = { "०": "0", "१": "1", "२": "2", "३": "3", "४": "4", "५": "5", "६": "6", "७": "7", "८": "8", "९": "9" };
const KANNADA_DIGITS: Record<string, string> = { "೦": "0", "೧": "1", "೨": "2", "೩": "3", "೪": "4", "೫": "5", "೬": "6", "೭": "7", "೮": "8", "೯": "9" };
const TELUGU_DIGITS: Record<string, string> = { "౦": "0", "౧": "1", "౨": "2", "౩": "3", "౪": "4", "౫": "5", "౬": "6", "౭": "7", "౮": "8", "౯": "9" };

const WORD_NUMBERS: Record<string, number> = {
  ek: 1, do: 2, teen: 3, char: 4, paanch: 5, panch: 5, chhe: 6, saat: 7, aath: 8, nau: 9, das: 10, bees: 20, pachees: 25, tees: 30, pentees: 35, chalees: 40, pentalees: 45, pachas: 50, pachpan: 55, saath: 60, pensath: 65, sattar: 70, pachattar: 75, assi: 80,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80,
  "एक": 1, "दो": 2, "तीन": 3, "चार": 4, "पांच": 5, "पाँच": 5, "दस": 10, "बीस": 20, "तीस": 30, "चालीस": 40, "पचास": 50, "साठ": 60, "सत्तर": 70, "अस्सी": 80,
  "ಒಂದು": 1, "ಎರಡು": 2, "ಮೂರು": 3, "ನಾಲ್ಕು": 4, "ಐದು": 5, "ಹತ್ತು": 10,
  "ఒకటి": 1, "రెండు": 2, "మూడు": 3, "నాలుగు": 4, "ఐదు": 5, "పది": 10,
};

function normalizeDigits(s: string) {
  return s.replace(/[०-९]/g, (d) => DEVANAGARI_DIGITS[d]).replace(/[೦-೯]/g, (d) => KANNADA_DIGITS[d]).replace(/[౦-౯]/g, (d) => TELUGU_DIGITS[d]);
}

// Negation words in every supported language; used only near the word they negate.
const NEG = "nahi|nahin|nai|no|not|never|without|don'?t|doesn'?t|didn'?t|illa|ledu|ledhu|kaadu|ಇಲ್ಲ|नहीं|नही|లేదు|లేవు|కాదు|இல்லை";
const NON_AGE_UNITS = "acre|acres|ekad|ekar|gunt\\w*|bigha|lakh|lac|hazaar|hazar|thousand|rupay|rupee|rupees|rs|%|kg|km|log|members?|ghar|gharon|houses?|ಎಕರೆ|ಗುಂಟೆ|ಲಕ್ಷ|ರೂ|एकड़|लाख|रुपये|ఎకరా|ఎకరాలు|లక్ష|రూ";

/** True when a negation word sits in the same clause, within `window` characters before or after the match. */
function negatedNear(text: string, m: RegExpMatchArray, window = 30): boolean {
  const start = m.index ?? 0;
  const before = text.slice(Math.max(0, start - window), start).split(/[.,;!?]/).pop() ?? "";
  const after = text.slice(start + m[0].length, start + m[0].length + window).split(/[.,;!?]/)[0];
  const re = rx(`\\b(${NEG})\\b`, "i");
  return re.test(before) || re.test(after);
}

function blank(text: string, m: RegExpMatchArray): string {
  const start = m.index ?? 0;
  return text.slice(0, start) + " ".repeat(m[0].length) + text.slice(start + m[0].length);
}

function num(token: string): number | null {
  const t = token.toLowerCase();
  if (/^\d+(\.\d+)?$/.test(t)) return parseFloat(t);
  return WORD_NUMBERS[t] ?? null;
}

// Romanised Hindi ("Hinglish"). One unambiguous function word is enough; the
// weak list holds words that also occur in English or other Indian languages,
// so two of those are needed before Latin text counts as Hindi.
const HINGLISH_STRONG = rx(`\\b(hoon|hun|hu|hai|hain|mera|meri|mere|gaon|gaav|zameen|zamin|kheti|saal|kaam|karta|karti|karte|rehta|rehti|rehte|nahi|nahin|haan|umar|umr|ghar|pati|patni|beta|beti|naam|paas|ugata|ugati|kharab|baarish|fasal|pitaji|mataji|bhai|behen|shaadi|mein|hoti|hota|wala|wali|rupaye|rupaiya)\\b`, "i");
const HINGLISH_WEAK = rx(`\\b(main|mai|se|ke|ki|ka|ko|aur|par|acre|ekad|bigha|ek|paanch)\\b`, "gi");

export function isHinglish(text: string): boolean {
  if (HINGLISH_STRONG.test(text)) return true;
  return (text.match(HINGLISH_WEAK)?.length ?? 0) >= 2;
}

export function detectLanguage(text: string): Lang {
  if (/[\u0A00-\u0A7F]/.test(text)) return "pa";
  if (/[\u0C80-\u0CFF]/.test(text)) return "kn";
  if (/[\u0C00-\u0C7F]/.test(text)) return "te";
  if (/[\u0B80-\u0BFF]/.test(text)) return "ta";
  // Assamese uses the Bengali script plus ৰ and ৱ, and আপুনি / আপোনাৰ.
  if (/[\u09F0\u09F1]/.test(text) || /আপুনি|আপোনাৰ|নমস্কাৰ/.test(text) || /[\u0980-\u09FF]/.test(text)) return "as";
  if (/[\u0900-\u097F]/.test(text)) {
    if (/तोर|तोहार|तोहरा|हमरा|हमनी|बानी|करेला|रहेला|रहेनी|बाड़|भोजपुरी|कइसे/.test(text)) return "bho";
    return "hi";
  }
  if (/\b(tohra|tohar|humra|bani|karele|kareli|bhojpuri)\b/i.test(text)) return "bho";
  if (isHinglish(text)) return "hi";
  return "en";
}

export function ruleExtract(textRaw: string, known: Partial<CitizenProfile> = {}): { delta: Partial<CitizenProfile>; evidence: FieldEvidence[] } {
  const text = normalizeDigits(textRaw);
  const lower = text.toLowerCase();
  const hits: Hit[] = [];
  const add = (field: ProfileKey, value: unknown, quote: string, confidence = 0.7) => hits.push({ field, value, quote, confidence });
  const grab = (re: RegExp) => { const m = text.match(re); return m ? m[0] : ""; };
  const has = (field: ProfileKey) => hits.some((h) => h.field === field);

  // household elders (before age, so "pitaji 72 saal" is never read as the speaker's age)
  const ELDER = "pitaji|papa|father|father in law|mother in law|grandfather|grandmother|dad|mom|mum|maa|ma|mother|amma|appa|ajji|ajja|thatha|dadi|dada|dadaji|dadiji|nani|nana|sasur|saas|ammi|abbu|ತಂದೆ|ತಾಯಿ|ಅಪ್ಪ|ಅಮ್ಮ|ಅಜ್ಜಿ|ಅಜ್ಜ|ಅತ್ತೆ|ಮಾವ|ಅಪ್ಪನ\\p{L}*|ಅಮ್ಮನ\\p{L}*|ಅಜ್ಜನ\\p{L}*|ಅಜ್ಜಿಗ\\p{L}*|నాన్నక\\p{L}*|అమ్మక\\p{L}*|తాతక\\p{L}*|తాతయ్య|నాన్నగారి\\p{L}*|అమ్మగారి\\p{L}*|पिता|पिताजी|माँ|मां|माता|दादी|दादा|नानी|नाना|सास|ससुर|आई|बाबा|आजी|आजोबा|అమ్మ|నాన్న|తాత|అమ్మమ్మ|నానమ్మ|అత్త|మామ|అమ్మగారు|నాన్నగారు|அம்மா|அப்பா|தாத்தா|பாட்டி|தந்தை|தாய்";
  const AGE_UNITS = "saal|sal|years?|yrs|वर्ष|साल|वर्षे|ವರ್ಷ|ವಯಸ್ಸು|ఏళ్ళు|ఏళ్లు|సంవత్సరాలు|సంవత్సరం|వయసు|వయస్సు|வயது|வயசு|ஆண்டு";
  const FIRST_PERSON_AGE = rx(`\\b(umar|umr|age|aged|main|mai|mein|i am|i'm|mera|meri|naanu|nenu|నేను|నాకు|నా వయసు|ನಾನು|ನನಗೆ|ನನ್ನ|उम्र|मैं|मेरी|मी|माझे)\\s*(hoon|hu|hun)?\\s*(\\d{1,3})?\\s*$`, "i");
  // "72 saal ke pitaji" / "pitaji 72 saal ke hain" / "My mother is 71"
  const elderRes = [
    rx(`(\\d{2})\\s*(${AGE_UNITS})[^.]{0,30}?\\b(${ELDER})\\b`, "i"),
    rx(`\\b(${ELDER})\\b[^.]{0,30}?(\\d{2})(?:\\s*(${AGE_UNITS}|ke|ki|ಆಗಿದೆ))?\\b(?!\\s*(${NON_AGE_UNITS})\\b)`, "i"),
  ];
  let ageText = text;
  for (const re of elderRes) {
    for (const m of text.matchAll(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g"))) {
      const n = parseInt(m.slice(1).find((g) => /^\d{2}$/.test(g ?? "")) ?? "0", 10);
      if (n < 70) continue;
      // "main 72 saal ka hoon, meri maa ke saath" is the speaker, not the elder
      if (re === elderRes[0] && FIRST_PERSON_AGE.test(text.slice(Math.max(0, (m.index ?? 0) - 24), m.index ?? 0))) continue;
      if (!has("householdMembers70Plus")) add("householdMembers70Plus", 1, m[0], 0.7);
      ageText = blank(ageText, m);
    }
  }

  // age
  const ageRe = new RegExp(`(\\d{1,3}|[${WORD}]+)\\s*(${AGE_UNITS}|umar|age)(?![${WORD}])`, "iu");
  const ageM = ageText.match(ageRe);
  let age: number | null = null;
  let ageQuote = "";
  if (ageM) { const n = num(ageM[1]); if (n != null && n > 0 && n < 120) { age = n; ageQuote = ageM[0]; } }
  if (age == null) {
    // "umar 45", "age 34", "वयस्सु 38", "వయసు 40", "ನನಗೆ 38"
    const m = ageText.match(rx(`\\b(umar|umr|age|aged|vayassu|vayasu|vayas|उम्र|उमर|वय|वयस्सु|वयसु|वयस|ವಯಸ್ಸು|ವಯಸು|ಪ್ರಾಯ|ನನಗೆ|వయసు|వయస్సు|నాకు|வயது|வயசு|எனக்கு)\\s*(is|hai|है|:)?\\s*(\\d{1,3})\\b`, "i"));
    if (m) { age = parseInt(m[3], 10); ageQuote = m[0]; }
  }
  if (age == null) {
    // "I am 34", "main 45 ka hoon" but not "I am 2 acre" or "main 3 log"
    const m = ageText.match(rx(`\\b(i am|i'm|main|mai|mein|मैं|ನಾನು|నేను|நான்)\\s*(\\d{1,3})\\b(?!\\s*(${NON_AGE_UNITS})\\b)`, "i"));
    if (m) { age = parseInt(m[2], 10); ageQuote = m[0]; }
  }
  if (age != null && age > 0 && age < 120) add("age", age, ageQuote, 0.8);

  // land
  const LAND_WORDS = "zameen|zamin|jameen|khet|kheti|land|farmland|farm|bhoomi|bhumi|polam|ಹೊಲ|ಜಮೀನು|ಭೂಮಿ|खेत|ज़मीन|जमीन|भूमि|భూమి|పొలం|పొలము|நிலம்|வயல்";
  const landNegM = text.match(rx(`\\b(landless|bhoomiheen|bhumiheen|भूमिहीन|ಭೂರಹಿತ|భూమిలేని|(${LAND_WORDS})[^.,]{0,14}?\\b(${NEG})\\b|(no|without|koi|don't have|do not have|dont have|not own)\\s+(own\\s+|any\\s+|apni\\s+)?(${LAND_WORDS}))\\b`, "i"));
  if (landNegM) add("isLandOwner", false, landNegM[0], 0.8);
  const LEASE = "kiraye|kiraya|lease|leased|tenant|bataai|ಗುತ್ತಿಗೆ|किराये|కౌలు|குத்தகை";
  if (rx(`\\b(${LEASE})\\b`, "i").test(lower)) add("isLandOwner", false, grab(rx(`\\b(${LEASE})\\b`, "i")), 0.7);
  const landM = new RegExp(`(\\d+(\\.\\d+)?|[${WORD}]+)\\s*(acres?|ekad|ekar|एकड़|ಎಕರೆ|ఎకరా|ఎకరాలు|ఎకరం|bighas?|gunthas?|guntas?|guntes?|ಗುಂಟೆ|hectares?)`, "iu").exec(text);
  if (landM) {
    const n = num(landM[1]);
    if (n != null) {
      const unit = landM[3].toLowerCase();
      const acres = /gunt|ಗುಂಟೆ/.test(unit) ? n / 40 : /bigha/.test(unit) ? n * 0.6 : /hect/.test(unit) ? n * 2.47 : n;
      add("landAcres", Math.round(acres * 100) / 100, landM[0], 0.8);
      if (!has("isLandOwner")) add("isLandOwner", true, landM[0], 0.6);
    }
  }
  if (!has("isLandOwner") && rx(`\\b(${LAND_WORDS})\\b`, "i").test(text) && !rx(`\\b(${NEG})\\b`, "i").test(lower.slice(0, 80))) {
    add("isLandOwner", true, grab(rx(`\\b(${LAND_WORDS})\\b`, "i")), 0.5);
  }

  // occupation
  const FARMER = "kisan|kheti|farmer|farming|ugata|ugati|ugate|fasal|crop|ರೈತ|ಬೇಸಾಯ|ಕೃಷಿ|किसान|खेती|शेतकरी|शेती|రైతు|రైతును|వ్యవసాయం|వ్యవసాయ|సేద్యం|விவசாயி|விவசாயம்|tamatar|dhaan|ragi|tomato";
  const LABOURER = "mazdoor|majdoor|mazdoori|majdoori|labou?r(?:ers?)?|coolie|cooly|kooli|daily wage|dihadi|hamali|ಕೂಲಿ|मजदूर|मजदूरी|मजूर|కూలి|కూలీ|కూలి పని|கூலி";
  // Someone who states acreage is a farmer even if they also do daily-wage work; without land, labour wins ("vyavasaya kooli").
  const farmOcc: [RegExp, CitizenProfile["occupationClass"], string][] = landM
    ? [[rx(`\\b(${FARMER}|${LABOURER})\\b`, "i"), "farmer", "farming"]]
    : [[rx(`\\b(${LABOURER})\\b`, "i"), "farm_labourer", "daily wage labour"], [rx(`\\b(${FARMER})\\b`, "i"), "farmer", "farming"]];
  const occ: [RegExp, CitizenProfile["occupationClass"], string][] = [
    ...farmOcc,
    [rx(`\\b(darzi|tailor|badhai|carpenter|lohar|blacksmith|kumhar|potter|mochi|cobbler|sunar|goldsmith|nai|barber|dhobi|washerman|mistri|mason|raj mistri|ಟೈಲರ್|ದರ್ಜಿ|ಕುಂಬಾರ|ಬಡಗಿ|दर्जी|बढ़ई|लोहार|कुम्हार|मोची|सुनार|नाई|धोबी|मिस्त्री|టైలర్|దర్జీ|కుమ్మరి|వడ్రంగి|కమ్మరి|weaver|bunkar|basket)\\b`, "i"), "artisan", "artisan trade"],
    [rx(`\\b(thela|rehdi|street vendor|hawker|sabzi bech|vendor|ಗಾಡಿ|ठेला|रेहड़ी|feri|pheri|బండి|వీధి వ్యాపారం)\\b`, "i"), "street_vendor", "street vending"],
    [rx(`\\b(ghar ka kaam|gharon mein kaam|maid|domestic|housekeeping|bartan|jhadu|ಮನೆಗೆಲಸ|ಮನೆ ಕೆಲಸ|ಮನೆಕೆಲಸ|घर का काम|घरों में काम|कामवाली|ఇంటి పని|ఇళ్లలో పని|ఇంటి పనులు|వంట పని|வீட்டு வேலை)\\b`, "i"), "domestic_worker", "domestic work"],
    [rx(`\\b(construction|building site|site pe|beldar|ಕಟ್ಟಡ|निर्माण|కట్టడం|భవన నిర్మాణం)\\b`, "i"), "construction", "construction work"],
    [rx(`\\b(driver|auto chalata|auto chalati|auto|rickshaw|cab|taxi|truck|lorry|tempo|driv(?:e|es|ing)\\s+(?:an?\\s+)?(?:auto|cab|taxi|truck|tractor|rickshaw|lorry|bus|car|tempo)|ಡ್ರೈವರ್|ಆಟೋ|ड्राइवर|ऑटो|ఆటో|డ్రైవర్|ஆட்டோ)\\b`, "i"), "driver", "driving"],
    [rx(`\\b(delivery|swiggy|zomato|zepto|blinkit|amazon|gig)\\b`, "i"), "gig_delivery", "delivery work"],
    [rx(`\\b(dukaan|dukan|shop|kirana|ಅಂಗಡಿ|दुकान|దుకాణం|కిరాణా|கடை)\\b`, "i"), "shopkeeper", "shopkeeper"],
    [rx(`\\b(sarkari naukri|government job|govt job|teacher in government|ಸರ್ಕಾರಿ ಕೆಲಸ|सरकारी नौकरी|ప్రభుత్వ ఉద్యోగం)\\b`, "i"), "govt_employee", "government job"],
    [rx(`\\b(company|office|private job|software|it job|salary|ಕಂಪನಿ|कंपनी|नौकरी|కంపెనీ|ఉద్యోగం)\\b`, "i"), "salaried_private", "private salaried job"],
    [rx(`\\b(student|padhai|padhta|padhti|college|ವಿದ್ಯಾರ್ಥಿ|छात्र|पढ़ाई|విద్యార్థి|చదువుతున్నాను)\\b`, "i"), "student", "student"],
    [rx(`\\b(housewife|homemaker|grihini|ಗೃಹಿಣಿ|गृहिणी|గృహిణి)\\b`, "i"), "homemaker", "homemaker"],
    [rx(`\\b(retired|pension|ನಿವೃತ್ತ|सेवानिवृत्त|పదవీ విరమణ|పెన్షన్)\\b`, "i"), "retired", "retired"],
  ];
  for (const [re, cls, plain] of occ) {
    const m = text.match(re);
    if (m) { add("occupationClass", cls, m[0], 0.75); add("occupation", plain, m[0], 0.6); if (cls === "artisan") add("artisanTrade", m[0], m[0], 0.6); break; }
  }

  // location
  const RURAL = "gaon|gaav|village|halli|ooru|ಹಳ್ಳಿ|ಊರು|ಗ್ರಾಮ|गाँव|गांव|ग्राम|गाव|గ్రామం|గ్రామము|ఊరు|ఊరి|పల్లె|పల్లెటూరు|கிராமம்|ஊர்";
  const villageM = new RegExp(`([${WORD}]+)\\s*(${RURAL})(?![${WORD}])`, "iu").exec(text);
  if (villageM) {
    if (!VILLAGE_STOP.has(villageM[1].toLowerCase())) add("village", villageM[1], villageM[0], 0.6);
    add("areaType", "Rural", villageM[0], 0.8);
  }
  else if (rx(`\\b(${RURAL}|dehat|ಹಳ್ಳಿಯ)\\b`, "i").test(text)) add("areaType", "Rural", grab(rx(`\\b(${RURAL})\\b`, "i")), 0.8);
  const URBAN = "shahar|sheher|city|town|bangalore|bengaluru|mysore|mysuru|hubli|mangalore|ಬೆಂಗಳೂರ|ಮೈಸೂರ|ನಗರ|ಪಟ್ಟಣ|शहर|పట్టణం|నగరం|సిటీ|நகரம்";
  if (!has("areaType") && rx(`\\b(${URBAN})\\b`, "i").test(text)) add("areaType", "Urban", grab(rx(`\\b(${URBAN})\\b`, "i")), 0.7);
  for (const [canonical, ...aliases] of DISTRICTS) {
    // Indic names are inflected (ತುಮಕೂರಿನವನು = "person from Tumakuru"), so match them as a prefix.
    const re = rx(`\\b(${[canonical, ...aliases].map((a) => (/^[A-Za-z ]+$/.test(a) ? `${a}\\b` : a)).join("|")})`, "i");
    if (re.test(text)) { add("district", canonical, grab(re), 0.7); add("state", "Karnataka", grab(re), 0.6); break; }
  }
  if (rx(`\\b(karnataka|ಕರ್ನಾಟಕ|कर्नाटक|కర్ణాటక|கர்நாடகா)\\b`, "i").test(text)) add("state", "Karnataka", grab(rx(`\\b(karnataka|ಕರ್ನಾಟಕ|कर्नाटक|కర్ణాటక|கர்நாடகா)\\b`, "i")), 0.9);

  // household
  const WIDOW = "vidhwa|widow|widowed|pati nahi rahe|pati ka dehant|pati guzar|husband died|husband passed|husband is no more|lost my husband|ವಿಧವೆ|ಗಂಡ ತೀರಿ|ಗಂಡ ಇಲ್ಲ|ಗಂಡ ಸತ್ತ|विधवा|पति नहीं रहे|पति का देहांत|భర్త చనిపోయారు|భర్త చనిపోయాడు|భర్త లేరు|భర్త పోయారు|వితంతువు|கணவர் இறந்து|விதவை";
  if (rx(`\\b(${WIDOW})\\b`, "i").test(text)) { add("maritalStatus", "widowed", grab(rx(`\\b(${WIDOW})\\b`, "i")), 0.8); add("gender", "female", "", 0.6); }
  const MARRIED = "shaadi\\s*shuda|shadi\\s*shuda|married|pati|patni|wife|husband|ಹೆಂಡತಿ|ಗಂಡ|ಮದುವೆಯಾಗಿದೆ|पत्नी|पति|शादीशुदा|शादी\\s*शुदा|భర్త|భార్య|పెళ్లయింది|கணவர்|மனைவி";
  if (!has("maritalStatus") && rx(`\\b(${MARRIED})\\b`, "i").test(text)) add("maritalStatus", "married", grab(rx(`\\b(${MARRIED})\\b`, "i")), 0.6);
  const FEMALE = "main aurat|mahila|woman|female|lady|ಮಹಿಳೆ|ಹೆಂಗಸು|महिला|औरत|స్త్రీ|మహిళ|ఆడ|பெண்|(?:karti|rehti|ugati|chalati|padhti|jaati|banati|bechti)\\s+(?:hoon|hun|hu)|(?:साल\\s+)?की\\s+हूँ|की\\s+हूं|करती\\s+हूँ|करती\\s+हूं|रहती\\s+हूँ|रहती\\s+हूं";
  if (rx(`\\b(${FEMALE})\\b`, "i").test(text)) add("gender", "female", grab(rx(`\\b(${FEMALE})\\b`, "i")), 0.6);

  // "ration card mein mera naam mukhiya hai" / "ration card is in my name": the woman is head of household
  const headM = text.match(rx(`\\b(ration card|rashan card|राशन कार्ड|ರೇಷನ್ ಕಾರ್ಡ್|రేషన్ కార్డు|ரேஷன் கார்டு)[^.]{0,24}?(mera naam|my name|मेरा नाम|मेरे नाम|ನನ್ನ ಹೆಸರ|నా పేరు|என் பெயர)|\\b(mera naam mukhiya|main mukhiya|mai mukhiya|mukhiya main|mukhiya hoon|मैं मुखिया|मुखिया हूँ|मुखिया हूं|मेरा नाम मुखिया|head of (?:the |my )?(?:household|family)|woman head|mahila mukhiya|ಮನೆ ಯಜಮಾನಿ|ಮುಖ್ಯಸ್ಥೆ|ನಾನೇ ಮುಖ್ಯಸ್ಥ|కుటుంబ పెద్ద|ఇంటి పెద్ద|నేనే పెద్ద|குடும்பத் தலைவி)\\b`, "i"));
  if (headM) {
    const gender = hits.find((h) => h.field === "gender")?.value ?? known.gender ?? null;
    if (gender === "female") add("isWomanHeadOfHousehold", true, headM[0], 0.75);
    else if (gender === "male") add("isWomanHeadOfHousehold", false, headM[0], 0.6);
  }

  // ration card
  if (rx(`\\b(aay|antyodaya|antodaya|pink card|yellow card|ಅಂತ್ಯೋದಯ|अंत्योदय|అంత్యోదయ)\\b`, "i").test(text)) add("rationCardType", "AAY", grab(rx(`\\b(aay|antyodaya|antodaya|pink card|yellow card|ಅಂತ್ಯೋದಯ|अंत्योदय|అంత్యోదయ)\\b`, "i")), 0.8);
  else if (rx(`\\b(bpl|garibi rekha|below poverty|ಬಿಪಿಎಲ್|बीपीएल|బీపీఎల్|white card|tella card|తెల్ల కార్డు)\\b`, "i").test(text)) add("rationCardType", "BPL", grab(rx(`\\b(bpl|garibi rekha|below poverty|ಬಿಪಿಎಲ್|बीपीएल|బీపీఎల్|white card|tella card|తెల్ల కార్డు)\\b`, "i")), 0.8);
  else if (rx(`\\b(apl|ಎಪಿಎಲ್|एपीएल|ఏపీఎల్)\\b`, "i").test(text)) add("rationCardType", "APL", grab(rx(`\\b(apl|ಎಪಿಎಲ್|एपीएल|ఏపీఎల్)\\b`, "i")), 0.8);
  else if (/ration card (nahi|nahin|नहीं)|no ration card|ರೇಷನ್ ಕಾರ್ಡ್ ಇಲ್ಲ|రేషన్ కార్డు లేదు/i.test(text)) add("rationCardType", "none", grab(/ration card (nahi|nahin)|no ration card|ರೇಷನ್ ಕಾರ್ಡ್ ಇಲ್ಲ|రేషన్ కార్డు లేదు/i), 0.8);

  // housing
  if (rx(`\\b(kachcha|kaccha|kutcha|mitti ka ghar|jhopdi|hut|ಗುಡಿಸಲು|कच्चा|झोपड़ी|గుడిసె|పూరిల్లు|పూరి ఇల్లు|குடிசை)\\b`, "i").test(text)) add("housingType", "kutcha", grab(rx(`\\b(kachcha|kaccha|kutcha|jhopdi|hut|ಗುಡಿಸಲು|कच्चा|గుడిసె|పూరిల్లు|குடிசை)\\b`, "i")), 0.8);
  else if (rx(`\\b(pakka|pucca|pakka ghar|cement house|ಪಕ್ಕಾ|पक्का|పక్కా|డాబా ఇల్లు)\\b`, "i").test(text)) add("housingType", "pucca", grab(rx(`\\b(pakka|pucca|ಪಕ್ಕಾ|पक्का|పక్కా|డాబా ఇల్లు)\\b`, "i")), 0.8);
  else if (rx(`\\b(ghar nahi|homeless|no house|ಮನೆ ಇಲ್ಲ|घर नहीं|ఇల్లు లేదు|சொந்த வீடு இல்லை)\\b`, "i").test(text)) add("housingType", "none", grab(rx(`\\b(ghar nahi|homeless|no house|ಮನೆ ಇಲ್ಲ|घर नहीं|ఇల్లు లేదు)\\b`, "i")), 0.8);

  // crop loss
  const CROP_LOSS = "fasal (?:kharab|barbad|nasht)|crop (?:loss|damage|fail|failed|failure)|lost (?:my|the) crop|baarish se|barish se|sookha|drought|ಬೆಳೆ (?:ಹಾನಿ|ನಷ್ಟ)|फसल (?:खराब|बर्बाद)|పంట (?:నష్టం|పోయింది|దెబ్బతింది)|కరువు|పయிர் (?:சேதம்|நஷ்டம்)|வறட்சி|hailstorm|ole|flood|baadh|varadalu|వరదలు|వరద";
  if (rx(`\\b(${CROP_LOSS})\\b`, "i").test(text)) {
    const q = grab(rx(`\\b(${CROP_LOSS})\\b`, "i"));
    add("recentCropLoss", true, q, 0.8);
    const cause = /baarish|barish|rain|flood|baadh|ಮಳೆ|बारिश|వర్షం|వరద|மழை/i.test(text) ? "unseasonal rain / flood" : /sookha|drought|ಬರ|सूखा|కరువు|வறட்சி/i.test(text) ? "drought" : /ole|hail/i.test(text) ? "hailstorm" : /keeda|pest|rog|ಕೀಟ|कीड़ा|పురుగు/i.test(text) ? "pest / disease" : null;
    if (cause) add("cropLossCause", cause, q, 0.7);
  }

  // tax / pf / govt: negation only counts when it sits next to the thing it negates ("PF katta hai, zameen nahi" keeps PF true)
  const taxM = text.match(rx(`\\b(income tax|tax bharta|tax deta|ಆದಾಯ ತೆರಿಗೆ|आयकर|ఆదాయపు పన్ను)\\b`, "i"));
  if (taxM) add("paysIncomeTax", !negatedNear(text, taxM), taxM[0], 0.7);
  const pfM = text.match(rx(`\\b(pf|epfo|esic|esi|provident)\\b`, "i"));
  if (pfM) add("hasEpfoOrEsic", !negatedNear(text, pfM), pfM[0], 0.7);

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
  const NO = "nahi|nahin|nai|no|nope|not|illa|ledu|ledhu|kaadu|ಇಲ್ಲ|नहीं|नही|లేదు|కాదు|இல்லை|alag|different|mismatch";
  if (rx(`\\b(haan|ha|han|ji haan|yes|yeah|yep|sahi|same|match|hai|ide|houdu|avunu|aamam|aam|ಹೌದು|ಇದೆ|हाँ|हां|जी|अवुनु|అవును|ఔను|ఉంది|ஆமாம்|ஆம்|இருக்கு)\\b`, "").test(t) && !rx(`\\b(${NO})\\b`, "").test(t)) return true;
  if (rx(`\\b(${NO}|galat|pata nahi|teliyadu|gottilla)\\b`, "").test(t)) return false;
  return null;
}
