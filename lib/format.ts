// Pure presentation helpers — safe to use on client or server.

/** Maps a status string to a badge CSS class (substring match, like the original app). */
export function statusBadgeClass(s: string): string {
  if (!s) return 'b-none';
  const l = s.toLowerCase();
  if (l.includes('not won') || l.includes('lost') || l.includes('not going')) return 'b-lost';
  if (l.trim() === 'closed') return 'b-closed';
  if (l.includes('ongoing')) return 'b-ongoing';
  if (l.includes('going well')) return 'b-well';
  if (l.includes('hold')) return 'b-onhold';
  if (l.includes('contract')) return 'b-contract';
  return 'b-none';
}

/** Maps a TARA string to a badge CSS class. */
export function taraBadgeClass(t: string): string {
  if (!t) return 'b-none';
  if (t.toLowerCase().includes('not')) return 'b-notcreated';
  return 'b-tara';
}

/** Formats a date string as e.g. "10 Apr 2026"; returns '—' when empty. */
export function fmtDate(d: string): string {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Human-readable file size. */
export function fileSize(bytes: number): string {
  return bytes > 1048576
    ? (bytes / 1048576).toFixed(1) + ' MB'
    : (bytes / 1024).toFixed(0) + ' KB';
}

/** Icon for a file based on type/extension. */
export function fileIcon(name: string, type = ''): string {
  if (type.includes('pdf') || /\.pdf$/i.test(name)) return '📄';
  if (/\.docx?$/i.test(name)) return '📝';
  if (/\.(png|jpe?g|gif|webp)$/i.test(name)) return '🖼️';
  return '📎';
}
