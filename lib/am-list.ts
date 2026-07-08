// Account Manager email addresses to watch for incoming request emails.
// Comparison is case-insensitive (Graph normalizes casing but be safe).

export const AM_EMAILS = [
  'harshvardhan.kondhare@imocha.io',
  'kshitij@imocha.io',
  'monika.Jamdar@imocha.io',
  'nikita.b@imocha.io',
  'nishant@imocha.io', // Nishant Thool
  'nishant.u@imocha.io', // Nishant Utkarsh
  'prudhvi.raj@idealabs.me', // Raj Prudhvi
  'ros@imocha.io', // Roshan
  'Sarvesh@imocha.io',
  'ambarish.kolankar@imocha.io',
  'subham.das@imocha.co', // self — for testing incoming request flow
] as const;

export const AM_EMAILS_LOWER = AM_EMAILS.map((e) => e.toLowerCase());

// Map from sender email (lowercased) to the person display name used in the tracker.
// Keep in sync with the names in your records table.
export const AM_EMAIL_TO_PERSON: Record<string, string> = {
  'harshvardhan.kondhare@imocha.io': 'Harshvarshan Kondhre',
  'kshitij@imocha.io': 'Kshitij Deshmukh',
  'monika.jamdar@imocha.io': 'Monika Jamdar',
  'nikita.b@imocha.io': 'Nikita Bhatkar',
  'nishant@imocha.io': 'Nishant Thool',
  'nishant.u@imocha.io': 'Nishant Utkarsh',
  'prudhvi.raj@idealabs.me': 'Raj Prudhvi',
  'ros@imocha.io': 'Roshan',
  'sarvesh@imocha.io': 'Sarvesh Parab',
  'ambarish.kolankar@imocha.io': 'Ambarish Kolankar',
  'subham.das@imocha.co': 'Subham Das',
};

/** Look up an AM's display name by email (case-insensitive). Returns null if not mapped. */
export function personFromEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  return AM_EMAIL_TO_PERSON[email.toLowerCase()] ?? null;
}
