#!/usr/bin/env node
/**
 * One-off importer for sessions exported from the original
 * presales_tracker.html app. Reads the JSON, logs in to the new
 * Next.js app with APP_PASSWORD, and POSTs all records to /api/records
 * in a single bulk call.
 *
 * Prerequisites:
 *   - dev server (or any running instance) reachable at APP_URL
 *   - .env.local has APP_PASSWORD and Supabase credentials
 *   - the records table exists (you've run supabase-schema.sql)
 *
 * Usage:
 *   node --env-file=.env.local scripts/import-old-session.mjs <json-file> [flags]
 *
 * Flags:
 *   --replace   wipe the tracker first, then insert (clean reset)
 *   --append    insert even if the tracker already has data (may duplicate)
 *   --dry-run   show what would be sent without actually posting
 *
 * Examples:
 *   node --env-file=.env.local scripts/import-old-session.mjs ~/Downloads/presales_20260520.json
 *   node --env-file=.env.local scripts/import-old-session.mjs sessions/old.json --replace
 */

import { readFile } from 'node:fs/promises';

const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const PASSWORD = process.env.APP_PASSWORD;

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const replace = args.includes('--replace');
const append = args.includes('--append');
const dryRun = args.includes('--dry-run');

if (!file) {
  console.error(
    'usage: node --env-file=.env.local scripts/import-old-session.mjs <json> [--replace|--append] [--dry-run]',
  );
  process.exit(2);
}
if (!PASSWORD) {
  console.error('APP_PASSWORD not set. Run with: node --env-file=.env.local ...');
  process.exit(2);
}

console.log(`Reading ${file} ...`);
const raw = await readFile(file, 'utf8');
const payload = JSON.parse(raw);
const oldRecords = Array.isArray(payload?.data) ? payload.data : null;
if (!oldRecords) {
  console.error('JSON has no "data" array — is this an exported session?');
  process.exit(2);
}
console.log(`  → ${oldRecords.length} records found`);

/** Old shape (jdFiles, loose fields) → new RecordInput (jd_files, sanitized). */
function transform(r) {
  return {
    person: String(r.person ?? '').trim(),
    customer: String(r.customer ?? '').trim(),
    status: String(r.status ?? ''),
    account: String(r.account ?? '').trim(),
    tara: String(r.tara ?? ''),
    notes: String(r.notes ?? '').trim(),
    date: String(r.date ?? ''),
    assessments: Array.isArray(r.assessments)
      ? r.assessments
          .map((a) => ({ name: String(a.name ?? '').trim(), qb: String(a.qb ?? '').trim() }))
          .filter((a) => a.name)
      : [],
    jd_files: Array.isArray(r.jdFiles)
      ? r.jdFiles.map((f) => ({
          name: String(f.name ?? ''),
          size: Number(f.size ?? 0),
          type: String(f.type ?? ''),
          dataUrl: String(f.dataUrl ?? ''),
        }))
      : [],
  };
}

const valid = oldRecords.map(transform).filter((r) => r.person && r.customer);
const skipped = oldRecords.length - valid.length;
if (skipped) console.log(`  → skipping ${skipped} record(s) missing person or customer`);

if (dryRun) {
  console.log(`\nDRY RUN — would post ${valid.length} records. First two:`);
  console.log(JSON.stringify(valid.slice(0, 2), null, 2));
  process.exit(0);
}

console.log(`\nLogging in at ${APP_URL}/api/login ...`);
const loginRes = await fetch(`${APP_URL}/api/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ password: PASSWORD }),
});
if (!loginRes.ok) {
  console.error(`Login failed: ${loginRes.status} ${await loginRes.text()}`);
  process.exit(1);
}
const setCookies = loginRes.headers.getSetCookie?.() ?? [];
const cookie = setCookies[0]?.split(';')[0];
if (!cookie) {
  console.error('Login succeeded but no Set-Cookie header returned.');
  process.exit(1);
}
console.log('  → logged in');

const existingRes = await fetch(`${APP_URL}/api/records`, { headers: { Cookie: cookie } });
const existing = (await existingRes.json()).records ?? [];
console.log(`Tracker currently has ${existing.length} record(s).`);
if (existing.length && !replace && !append) {
  console.error('Refusing to import on top of existing data.');
  console.error('  --replace   wipe and insert');
  console.error('  --append    add anyway (may duplicate person+customer pairs)');
  process.exit(1);
}

console.log(`\nPOSTing ${valid.length} records (${replace ? 'replace' : 'append'}) ...`);
const postRes = await fetch(`${APP_URL}/api/records`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Cookie: cookie },
  body: JSON.stringify({ records: valid, replace }),
});
const result = await postRes.json().catch(() => ({}));
if (!postRes.ok) {
  console.error(`POST failed: ${postRes.status}`, result);
  process.exit(1);
}
console.log(`\n✓ Imported ${result.records?.length ?? '?'} record(s).`);
