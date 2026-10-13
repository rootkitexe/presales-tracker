#!/usr/bin/env node
/**
 * Creates / updates the database schema from schema.sql.
 * Idempotent — safe to run again after pulling schema changes.
 *
 * Usage:
 *   node --env-file=.env.local scripts/db-setup.mjs
 *
 * Needs DATABASE_URL (use the database's public URL when running locally).
 */

import { readFile } from 'node:fs/promises';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL not set. Run with: node --env-file=.env.local scripts/db-setup.mjs');
  process.exit(2);
}

const schema = await readFile(new URL('../schema.sql', import.meta.url), 'utf8');
const sql = postgres(url, { ssl: 'prefer', max: 1, onnotice: () => {} });
try {
  await sql.unsafe(schema);
  const tables = await sql`
    select table_name from information_schema.tables
    where table_schema = 'public' order by table_name`;
  console.log('✓ Schema applied. Tables/views:', tables.map((t) => t.table_name).join(', '));
} catch (e) {
  console.error('Schema failed:', e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
