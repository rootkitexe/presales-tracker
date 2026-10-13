// Server-side helpers shared by the /api/records route handlers.

import type { JdFile, RecordFields, RecordInput } from './types';

/** Normalises an untrusted payload into the editable record fields. */
export function sanitizeFields(r: Record<string, unknown>): RecordFields {
  return {
    person: String(r.person ?? '').trim(),
    customer: String(r.customer ?? '').trim(),
    status: String(r.status ?? ''),
    account: String(r.account ?? '').trim(),
    tara: String(r.tara ?? ''),
    notes: String(r.notes ?? '').trim(),
    date: String(r.date ?? ''),
    assessments: Array.isArray(r.assessments)
      ? r.assessments.map((a) => ({
          name: String(a?.name ?? '').trim(),
          qb: String(a?.qb ?? '').trim(),
        }))
      : [],
  };
}

/** Normalises an untrusted list of files. Files without content are dropped. */
export function sanitizeFiles(v: unknown): JdFile[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((f) => ({
      name: String(f?.name ?? ''),
      size: Number(f?.size ?? 0) || 0,
      type: String(f?.type ?? ''),
      dataUrl: String(f?.dataUrl ?? ''),
    }))
    .filter((f) => f.name && f.dataUrl.startsWith('data:'));
}

/** Full new-record row (fields + uploaded files). */
export function sanitizeNew(r: Record<string, unknown>): RecordInput {
  return { ...sanitizeFields(r), jd_files: sanitizeFiles(r.jd_files) };
}
