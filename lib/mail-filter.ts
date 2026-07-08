// Keyword filter for polled Outlook emails.
// A message from an AM address only becomes a "recent request" if its subject
// or body preview contains at least one of these keywords (case-insensitive).
//
// Two categories combined with OR:
//   1. Action markers — someone tagging or asking you to do something
//   2. Topic keywords — presales / assessment / hiring vocabulary
//
// Add or remove entries here to tune the filter. Case doesn't matter — all
// comparisons happen after `.toLowerCase()`.

// eslint-disable-next-line prettier/prettier
const ACTION_MARKERS = [
  '@subham',
  '@shubham',
  'subham,',
  'shubham,',
  'subham -',
  'shubham -',
  '++ subham',
  '++ shubham',
  'subham dash',
  'shubham dash',
  'please copy',
  'kindly copy',
  'please add',
  'kindly add',
  'please create',
  'kindly create',
  'please review',
  'kindly review',
  'please help',
  'kindly help',
  'pick this up',
];

const TOPIC_KEYWORDS = [
  'assessment',
  'requirement',
  'requirements',
  'requisition',
  'skill assessment',
  'skills assessment',
  'role assessment',
  'jd',
  'job description',
  'rfi',
  'rfp',
  'hiring',
  'test creation',
  'interview',
  'ai interview',
  'vacancy',
  'vacancies',
  'position',
  'positions',
  'talent',
  'skill evaluation',
  'candidate',
  'ai skills match',
  'skill match',
  'question bank',
  'qb',
  'opening',
  'openings',
];

const ALL_KEYWORDS = [...ACTION_MARKERS, ...TOPIC_KEYWORDS];

/**
 * Returns true if the subject or body preview contains at least one keyword.
 * Both inputs may be null/undefined — treated as empty strings.
 */
export function looksLikeRequest(
  subject: string | null | undefined,
  bodyPreview: string | null | undefined,
): boolean {
  const text = ((subject ?? '') + ' ' + (bodyPreview ?? '')).toLowerCase();
  return ALL_KEYWORDS.some((k) => text.includes(k));
}
