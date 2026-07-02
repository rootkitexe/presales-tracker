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
] as const;

export const AM_EMAILS_LOWER = AM_EMAILS.map((e) => e.toLowerCase());
