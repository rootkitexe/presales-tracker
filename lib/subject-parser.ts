// Best-effort customer name extraction from email subject lines.
// Returns null if no pattern matches — caller falls back to blank field.
//
// Patterns handled (observed in real emails):
//   "Fw: RFI - Talent Potential Assessment Solution - Nissan Middle East"
//   "Fw: GFH : Skill Assessment @ iDealabs iMocha"
//   "Re: JioStar Requirement"
//   "Re: New requirement Nama supply"
//   "Re: Skill Assessment for TD: Talent Evo"
//   "Re: [EXTERNAL] Skills Intelligence for Talent Acquisition - Kobre & Kim "
//   "Fw: Demo Next week"                            → no reliable customer
//   "Sr Java Eng, Full-Stack Eng - JD"              → no customer in subject

const PREFIX = /^(?:re|fw|fwd)\s*:\s*/i;
const BRACKETED = /^\[[^\]]*\]\s*/; // strip "[EXTERNAL] " and similar

function stripPrefixes(s: string): string {
  let out = s.trim();
  // Peel multiple Re:/Fw: prefixes
  while (PREFIX.test(out)) out = out.replace(PREFIX, '');
  // Peel [EXTERNAL], [SPAM], etc.
  while (BRACKETED.test(out)) out = out.replace(BRACKETED, '');
  return out.trim();
}

const REQUEST_WORDS = [
  'requirement',
  'requirements',
  'requisition',
  'skill assessment',
  'skills assessment',
  'skills intelligence',
  'role assessment',
  'assessment',
  'hiring',
  'rfi',
  'rfp',
  'job description',
  'jd',
];

/** Extracts a best-effort customer name from an email subject. Returns null if unsure. */
export function parseCustomerFromSubject(subject: string | null | undefined): string | null {
  if (!subject) return null;
  const s = stripPrefixes(subject);
  if (!s) return null;

  // Pattern 1: "<CUSTOMER> : Skill Assessment @ ..." — customer before " : "
  const m1 = s.match(/^([A-Za-z0-9&.\-'()]+(?:\s+[A-Za-z0-9&.\-'()]+){0,4})\s*:\s*/);
  if (m1) {
    const cand = m1[1].trim();
    if (cand.length > 1 && !/^(?:re|fw|fwd)$/i.test(cand)) return cand;
  }

  // Pattern 2: "... - <CUSTOMER>" — text after the LAST " - " (customer often trails)
  const parts = s.split(/\s+-\s+/);
  if (parts.length >= 2) {
    const tail = parts[parts.length - 1].trim();
    // Drop trailing "JD" / "Skill Assessment" tags
    const cleaned = tail
      .replace(/\s+(?:JD|Job Description|Skill Assessment|Role Assessment)\.?\s*$/i, '')
      .trim();
    if (cleaned && cleaned.length > 1 && !/@/.test(cleaned)) return cleaned;
  }

  // Pattern 3: "<CUSTOMER> Requirement" / "<CUSTOMER> Requisition"
  for (const w of REQUEST_WORDS) {
    const re = new RegExp(`^(.+?)\\s+${w.replace(/ /g, '\\s+')}\\b`, 'i');
    const m = s.match(re);
    if (m) {
      const cand = m[1].trim();
      if (cand.length > 1 && cand.length < 60) return cand;
    }
  }

  return null;
}
