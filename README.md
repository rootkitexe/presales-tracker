# Presales Tracker

The original single-file `presales_tracker.html` ported to **Next.js 16 + Supabase**, with a shared-password gate. All data now lives in a real Postgres database — no more save/load JSON files.

## Stack

- **Next.js 16** (App Router, React 19, Turbopack)
- **Supabase** — Postgres for records (file-storage decision deferred — see below)
- **Tailwind CSS v4** utilities; the original cream/beige theme is ported verbatim into `app/globals.css`
- **xlsx** for Excel import/export
- Shared password gate: `APP_PASSWORD` → sha256 → httpOnly cookie → server-side verified in `proxy.ts`, `app/page.tsx`, and every API route

## Quick start

```bash
cd presales-tracker
# .env.local already exists with APP_PASSWORD set; just fill in the Supabase values
npm install                        # already done if you ran create-next-app
npm run dev
```

Open http://localhost:3000, enter the password, and you're in.

## Supabase setup

1. Create a free project at https://supabase.com (no credit card needed).
2. **Project Settings → Data API → Project URL** → paste into `SUPABASE_URL`.
3. **Project Settings → API Keys → `service_role` key** → paste into `SUPABASE_SERVICE_ROLE_KEY`. **Keep secret** — it is server-only and bypasses Row Level Security.
4. **SQL Editor → New query** → paste the contents of [`supabase-schema.sql`](./supabase-schema.sql) → Run.

Refresh the app and records load from Postgres.

## Importing an old session JSON

If you have a JSON file exported from the original HTML app (its **Save** button downloads one), import the records in one shot:

```bash
cd presales-tracker
node --env-file=.env.local scripts/import-old-session.mjs <path-to-json>
```

The script logs in with `APP_PASSWORD`, then POSTs every record in a single bulk call to `/api/records`. Flags:

- `--replace` — wipe the tracker first, then insert (clean reset)
- `--append` — insert even if the tracker already has data (may duplicate)
- `--dry-run` — show what would be sent without actually posting

It maps the old `jdFiles` shape onto the new `jd_files` column, so attached files survive the move. Records missing `person` or `customer` are skipped with a count.

## The password gate

- Set `APP_PASSWORD` in `.env.local`. Anyone with that password can log in at `/login` and gets full access.
- The cookie value stored in the browser is `sha256(APP_PASSWORD)` — knowing the cookie does not reveal the password.
- Verification happens **server-side** in three places:
  1. `proxy.ts` — fast optimistic cookie-presence check (Edge runtime; in Next.js 16 this file replaces what used to be `middleware.ts`).
  2. `app/page.tsx` — real hash compare before rendering the UI.
  3. Each `/api/records*` route handler — real hash compare before any DB call.

To change the password, edit `APP_PASSWORD` in `.env.local` (or in Vercel's project settings) and ask everyone to log in again.

## JD-file storage (deferred — see TODO)

JD files are currently stored as **base64 data URLs inside the `jd_files` JSON column** on each record. This keeps the app fully functional today with no extra service, no credit card, and no new credentials — but it inflates each row. When you decide to add a real storage provider, the migration is small and contained:

- Add a `lib/storage.ts` adapter exposing `uploadFile()` / `getFileUrl()` / `deleteFile()`.
- Change `JdFile.dataUrl` → `JdFile.url` in [`lib/types.ts`](./lib/types.ts) and have the upload path call `uploadFile()` instead of `FileReader`.
- Pick a provider — **Supabase Storage** stays in this stack with zero new account (1 GB free), **Cloudflare R2** is a stronger free tier (10 GB + zero egress) if you don't mind a credit card and a second service.

The touch points are marked `TODO(storage):` in [`lib/types.ts`](./lib/types.ts) and [`lib/files.ts`](./lib/files.ts).

## Deploy to Vercel

1. `git init && git add . && git commit -m "initial"`.
2. Push to GitHub.
3. https://vercel.com → New Project → import the repo.
4. In Project Settings → Environment Variables, add the three values from `.env.local`:
   - `APP_PASSWORD`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. Deploy.

Vercel auto-detects Next.js; no `vercel.json` is needed.

## Architecture

```
app/
├── layout.tsx              root layout
├── globals.css             theme ported from the original HTML
├── page.tsx                protected entry; renders <App/>
├── login/page.tsx          password form
└── api/
    ├── login/route.ts            POST: verify password, set cookie
    ├── logout/route.ts           POST: clear cookie
    ├── records/route.ts          GET list / POST create or bulk-replace
    └── records/[id]/route.ts     PUT update / DELETE remove

components/
├── App.tsx                 client shell: header, tabs, toast, confirm, data
├── Tracker.tsx             table, filters, stats, inline JD panel
├── RecordModal.tsx         add / edit form
├── ImportTab.tsx           Excel parse → column mapper → preview → append/replace
├── BulkJD.tsx              multi-file upload → assign to records → commit
├── SalesForm.tsx           focused single-entry form (writes straight to DB)
├── Dashboard.tsx           stat tiles + bar charts
├── ConfirmDialog.tsx       promise-based confirm
└── AssessmentsEditor.tsx   reusable dynamic-list editor

lib/
├── types.ts                PresalesRecord, Assessment, JdFile, RecordInput
├── constants.ts            STATUS_OPTIONS, TARA_OPTIONS
├── format.ts               badge classes, fmtDate, fileSize, fileIcon
├── api.ts                  client fetch helpers
├── files.ts                readFilesAsJd, viewJdFile
├── auth.ts                 server-side password + cookie helpers
└── supabase.ts             server-only service-role client (lazy singleton)

proxy.ts                    Next.js 16 "Proxy" (was middleware) — optimistic gate
supabase-schema.sql         DDL: one `records` table + RLS lockdown
```

### Data model

One `records` row per request:

| column                  | type          | notes |
|-------------------------|---------------|-------|
| id                      | uuid          | PK |
| person                  | text          | "Request From" |
| customer                | text          | |
| status                  | text          | from `STATUS_OPTIONS` |
| account                 | text          | account email |
| tara                    | text          | TARA status |
| notes                   | text          | |
| date                    | text          | `'YYYY-MM-DD'` or `''` (kept flexible for Excel imports) |
| assessments             | jsonb         | `[{ name, qb }]` |
| jd_files                | jsonb         | `[{ name, size, type, dataUrl }]` — see TODO |
| created_at, updated_at  | timestamptz   | `updated_at` maintained by trigger |

**Row Level Security is enabled with no policies** — meaning the anon key cannot touch this table. The app only reaches it via the service-role key from server-side route handlers, which bypass RLS.

### What changed from the original HTML app

- **No more Save / Load JSON** — Postgres persists everything.
- **Sales Form** now submits straight to the shared DB. (The original exported a JSON file the manager imported back; with shared access, that dance is no longer needed.)
- All other features — Tracker filters, inline JD upload, Bulk JD assignment, Excel Import with column mapper + duplicate detection, Excel Export, Dashboard — are the same.

## Scripts

```bash
npm run dev      # http://localhost:3000
npm run build    # production build
npm run start    # serve the production build
npm run lint
```

## Notes on Next.js 16

A few things differ from older Next.js versions:

- `middleware.ts` is now `proxy.ts` (same job, new name).
- Route Handler `params` is a `Promise` — `await ctx.params`.
- `cookies()` from `next/headers` is async — `await cookies()`.
- Tailwind v4 — no `tailwind.config.js`; theme tokens go in CSS. This project just uses plain CSS custom properties on `:root` since the design was hand-rolled.
