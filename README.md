# Presales Tracker

The original single-file `presales_tracker.html` ported to **Next.js 16 + Postgres**, with a shared-password gate. Hosted on **Railway** (app + database in one project).

## Stack

- **Next.js 16** (App Router, React 19, Turbopack)
- **Postgres** via [`postgres`](https://github.com/porsager/postgres) (postgres.js) — server-side only, see [`lib/db.ts`](./lib/db.ts)
- **Tailwind CSS v4** utilities; the original cream/beige theme is ported verbatim into `app/globals.css`
- **xlsx** for Excel import/export
- Integrations: **Outlook** (Microsoft Graph, Mail.Read) for incoming AM requests, **HubSpot** (deals/companies), **OpenRouter** (AI assistant on the Dashboard)
- Shared password gate: `APP_PASSWORD` → sha256 → httpOnly cookie → server-side verified in `proxy.ts`, `app/page.tsx`, and every API route

## Quick start (local)

```bash
cd presales-tracker
cp .env.local.example .env.local   # then fill in the values
npm install
node --env-file=.env.local scripts/db-setup.mjs   # create tables/views (idempotent)
npm run dev
```

Open http://localhost:3000, enter the password, and you're in.

## Environment variables

| Variable | Purpose |
|---|---|
| `APP_PASSWORD` | Shared login password |
| `DATABASE_URL` | Postgres connection string. Locally: the database's **public** URL. On Railway: `${{Postgres.DATABASE_URL}}` (private network) |
| `HUBSPOT_TOKEN` | HubSpot private-app token (HubSpot tab + AI search). Optional `HUBSPOT_PORTAL_ID` enables "Open ↗" links |
| `AZURE_AD_CLIENT_ID`, `AZURE_AD_TENANT_ID`, `AZURE_AD_CLIENT_SECRET` | Azure app registration for Outlook. **Client secrets expire** — renew before the expiry date |
| `NEXTAUTH_URL` | Public base URL of the app, e.g. `https://<app>.up.railway.app`. The Azure redirect URI must be `<NEXTAUTH_URL>/api/auth/callback/azure-ad` |
| `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` | AI assistant |

## Database

[`schema.sql`](./schema.sql) defines everything: `records`, `ms_account` (connected Outlook account), `recent_requests` (polled AM emails), and two list views. Apply it with:

```bash
node --env-file=.env.local scripts/db-setup.mjs
```

The script is idempotent — re-run it after pulling schema changes. Only the app server connects to the database; the browser goes through `/api/*`.

**Egress rule:** list endpoints never return file bytes. `/api/records` and `/api/recent-requests` read the `records_list` / `recent_requests_list` views (names, sizes, types only); a file's bytes are fetched one at a time via `/api/records/:id/files/:idx` or `/api/recent-requests/:id/attachments` when someone opens it. Edits never re-send existing files — they are added/removed via `/api/records/:id/files`. Keep it that way: selecting `jd_files` or `attachments` in a list query is what exhausted the old Supabase/Vercel free-tier quotas.

## Deploy to Railway

1. Railway → **New Project → Deploy from GitHub repo** → this repo. Railway detects Next.js (`npm run build` / `npm start`).
2. In the same project: **+ New → Database → PostgreSQL**.
3. App service → **Variables**: add the variables above, with `DATABASE_URL = ${{Postgres.DATABASE_URL}}`.
4. App service → **Settings → Networking → Generate Domain**; set `NEXTAUTH_URL` to it.
5. Run `scripts/db-setup.mjs` once against the database's public URL (from your machine) to create the schema.
6. Ask the Azure app owner to add `<NEXTAUTH_URL>/api/auth/callback/azure-ad` as a redirect URI, then **Connect Outlook** once in the app.

Every push to `main` redeploys.

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

- Set `APP_PASSWORD` in `.env.local` (and in Railway's variables). Anyone with that password can log in at `/login` and gets full access.
- The cookie value stored in the browser is `sha256(APP_PASSWORD)` — knowing the cookie does not reveal the password.
- Verification happens **server-side** in three places:
  1. `proxy.ts` — fast optimistic cookie-presence check (in Next.js 16 this file replaces what used to be `middleware.ts`).
  2. `app/page.tsx` — real hash compare before rendering the UI.
  3. Every `/api/*` route handler (except login/logout) — real hash compare before any DB call.

To change the password, edit `APP_PASSWORD` and ask everyone to log in again.

## JD-file storage (deferred — see TODO)

JD files are stored as **base64 data URLs inside the `jd_files` JSON column** on each record. That keeps the app self-contained, and the egress rule above keeps it cheap. If files grow large, move them to object storage:

- Add a `lib/storage.ts` adapter exposing `uploadFile()` / `getFileUrl()` / `deleteFile()`.
- Change `JdFile.dataUrl` → `JdFile.url` in [`lib/types.ts`](./lib/types.ts) and have the upload path call `uploadFile()` instead of `FileReader`.

The touch points are marked `TODO(storage):` in [`lib/types.ts`](./lib/types.ts) and [`lib/files.ts`](./lib/files.ts).

## Architecture

```
app/
├── layout.tsx, page.tsx, login/page.tsx
└── api/
    ├── login, logout                       password gate
    ├── records/                            GET list / POST create or bulk-replace
    ├── records/[id]/                       PUT fields / DELETE
    ├── records/[id]/files[/idx]            POST add / GET one / DELETE one JD file
    ├── recent-requests/                    pending emails list, /count
    ├── recent-requests/[id]/               body, attachments, dismiss, mark-processed
    ├── inbound-mail/poll                   pull new AM emails from Outlook
    ├── auth/microsoft/*, auth/callback/    Outlook connect / status / disconnect
    ├── hubspot/{deals,companies}           HubSpot proxy
    └── ai/chat                             OpenRouter tool-use loop

components/   App shell, TrackerV2 (All Requests), RecentRequests (+Reader), Dashboard
              (+AIChat), HubspotTab, RecordModal; hidden: Tracker v1, ImportTab, BulkJD, SalesForm
lib/          db.ts (Postgres), auth.ts, api.ts (client fetch helpers), records.ts
              (payload sanitising), files.ts, ms-oauth.ts, hubspot.ts, ai-tools.ts,
              am-list.ts, mail-filter.ts, subject-parser.ts, types.ts, constants.ts, format.ts
schema.sql    tables + list views
scripts/      db-setup.mjs, import-old-session.mjs
proxy.ts      Next.js 16 "Proxy" (was middleware) — optimistic gate
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

## Scripts

```bash
npm run dev      # http://localhost:3000
npm run build    # production build
npm run start    # serve the production build
npm run lint
```

## Notes on Next.js 16

- `middleware.ts` is now `proxy.ts` (same job, new name).
- Route Handler `params` is a `Promise` — `await ctx.params`.
- `cookies()` from `next/headers` is async — `await cookies()`.
- Tailwind v4 — no `tailwind.config.js`; theme tokens go in CSS.
