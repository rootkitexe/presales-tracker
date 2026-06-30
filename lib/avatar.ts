export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const AVATAR_PALETTE = [
  { bg: '#EDE9FE', fg: '#6D28D9' }, // purple
  { bg: '#DBEAFE', fg: '#1D4ED8' }, // blue
  { bg: '#D1FAE5', fg: '#047857' }, // green
  { bg: '#FCE7F3', fg: '#BE185D' }, // pink
  { bg: '#FEF3C7', fg: '#92400E' }, // amber
  { bg: '#CCFBF1', fg: '#0F766E' }, // teal
  { bg: '#E0E7FF', fg: '#3730A3' }, // indigo
];

export function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}
