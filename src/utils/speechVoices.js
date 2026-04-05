// Scores installed speech voices so we prefer neural / natural-sounding engines over legacy robotic ones.

const POSITIVE = /neural|natural|premium|enhanced|wavenet|generative|online|wave|multilingual|expressive/i;
const NEGATIVE =
  /compact|embedded|android\s*tts|sapi|espeak|pico|test\s*voice|speech\s*fx|microsoft\s+zira|microsoft\s+hazel/i;

function scoreVoice(v) {
  const name = v.name.toLowerCase();
  const lang = (v.lang || "").toLowerCase();
  let score = 0;

  if (lang.startsWith("en")) score += 24;
  if (lang === "en-in" || lang.startsWith("en-in-")) score += 18;
  if (lang === "en-us" || lang === "en-gb" || lang === "en_gb") score += 10;
  if (lang === "gu-in" || lang === "gu" || lang.startsWith("gu-in-")) score += 18;

  if (POSITIVE.test(name)) score += 48;
  if (NEGATIVE.test(name)) score -= 70;

  if (v.localService === false) score += 14;

  if (/google|microsoft|apple|samsung|amazon polly|ivona/i.test(name)) score += 12;
  if (/aria|jenny|michelle|sonia|natasha|guy|ryan|samantha|karen|daniel|thomas|fiona|serena|emma|oliver|libby|maisie|alfie|davis|jane|jason|nancy|tony|sara|brandon|christopher|corinne|elizabeth|eric|jacob|ashley|linda|matthew|anya|dmitry|dariya/i.test(name)) {
    score += 8;
  }

  if (v.default) score += 4;

  return score;
}

// Returns the best-ranked English-first voice for human-like announcements.
export function pickPreferredVoice(voices) {
  if (!voices?.length) return null;
  const ranked = [...voices].sort((a, b) => scoreVoice(b) - scoreVoice(a));
  return ranked[0] || null;
}

// Resolves a voice URI from the current engine list (voices refresh async on many browsers).
export function resolveVoiceByUri(voices, voiceURI) {
  if (!voiceURI || !voices?.length) return null;
  return voices.find((v) => v.voiceURI === voiceURI) || null;
}

// Lists voices suitable for the picker (English + high-quality others), deduped by URI.
export function listVoicesForPicker(voices, { max = 80 } = {}) {
  if (!voices?.length) return [];
  const seen = new Set();
  const out = [];
  const enFirst = [...voices].sort((a, b) => {
    const ae = a.lang?.toLowerCase().startsWith("en") ? 0 : 1;
    const be = b.lang?.toLowerCase().startsWith("en") ? 0 : 1;
    if (ae !== be) return ae - be;
    return a.name.localeCompare(b.name);
  });
  for (const v of enFirst) {
    if (seen.has(v.voiceURI)) continue;
    seen.add(v.voiceURI);
    out.push(v);
    if (out.length >= max) break;
  }
  return out;
}

function normalizeLangTag(lang) {
  return (lang || "").toLowerCase().replace("_", "-");
}

// Picks the best English (India) voice (en-IN) for announcements.
export function pickEnglishIndiaVoice(voices) {
  if (!voices?.length) return null;
  const candidates = voices.filter((v) => {
    const l = normalizeLangTag(v.lang);
    return l === "en-in" || l.startsWith("en-in-");
  });
  if (!candidates.length) return null;
  return [...candidates].sort((a, b) => scoreVoice(b) - scoreVoice(a))[0];
}

// Picks the best Gujarati voice (gu-IN / gu) for announcements.
export function pickGujaratiVoice(voices) {
  if (!voices?.length) return null;
  const candidates = voices.filter((v) => {
    const l = normalizeLangTag(v.lang);
    return l === "gu-in" || l === "gu" || l.startsWith("gu-in-");
  });
  if (!candidates.length) return null;
  return [...candidates].sort((a, b) => scoreVoice(b) - scoreVoice(a))[0];
}
