# Hapoel Schedule

A Hebrew youth-football schedule management app for Hapoel Be'er Sheva.

## Stack

- Next.js 16 / React 19
- TypeScript
- Drizzle ORM
- Netlify Database
- Netlify for the hosted version

## Open locally on a new computer

The repository is intentionally set up so an AI coding assistant can take over the local setup with minimal instructions.

### For a human

Requirements:

- Node.js 22
- Git

Then:

```bash
git clone https://github.com/gamechangersbgu-eng/hapoel-schedule.git
cd hapoel-schedule
npm ci
npm run dev:local
```

The app will be available at the local URL printed by Netlify CLI (normally `http://localhost:8888`).

### For an AI coding assistant

If the user says:

> "Open hapoel-schedule locally"

use this repository, install dependencies with `npm ci`, and start it with:

```bash
npm run dev:local
```

If Node.js is missing or is not version 22, install/use Node 22 first.

Do **not** start with `npm start`; that command requires a production build.

### Local database

The app uses Netlify Database through Netlify's local development environment. `netlify dev` is the intended local entry point because it provides the local Netlify environment the app expects.

The repository contains database migrations under `netlify/database/migrations/` and demo data in `db/seed.ts`.

## Demo data

The database seed contains realistic demo schedule data.

To reset/seed the local database when the local database environment is available:

```bash
npm run db:seed
```

## Useful commands

```bash
npm run dev:local   # Recommended local development
npm run build       # Production build
npm start           # Run an already-built production app
npm run lint        # Lint
npm run db:seed     # Reset and load demo schedule data
```

## Project structure

- `app/` — Next.js pages and server actions
- `components/` — UI components
- `db/` — Drizzle schema and seed data
- `lib/` — schedule/domain helpers
- `netlify/database/migrations/` — database migrations
- `public/` — static assets
- `netlify.toml` — Netlify configuration

## Admin

The schedule editor is at:

```
/admin
```

The public schedule is at:

```
/
```

## Important

Do not commit real credentials or production environment variables. Local environment files such as `.env.local` are ignored by Git.

## Static site on GitHub Pages (with in-browser admin editing)

`npm run build:pages` builds a static copy of the schedule into `out/` (no database, no server
actions, no passwords). It is deployed by `.github/workflows/pages.yml` to
`https://<user>.github.io/hapoel-schedule/`. The normal app / Netlify setup (`npm run build`)
is not affected. The code lives in `static-site/` (`build.mjs` + `overlay/`, which replaces a few
files in a temporary copy of the app at build time).

### Editing the schedule on the static site (shared with everyone)

1. Click **כניסת מנהל** (no username or password; it is just a switch in the browser, not security).
2. Click a cell to add, edit or delete a training / game / camp (same fields and validations as `/admin`).
   **העתק שבוע קודם** copies last week into the current one. Click **יציאה ממצב מנהל** to leave.
3. Every change is saved automatically for **all visitors**; the page shows "נשמר לכולם" when it worked, or a
   Hebrew error with a retry link when it did not. **אפס לברירת מחדל** resets the shared schedule for everyone.

How it works: the static site reads and writes one small JSON document (the *edits* layered over the demo data /
`schedule-data.json`: `{ upserts, deletedIds }`) in the free public store [textdb.dev](https://textdb.dev):

    https://textdb.dev/api/data/hapoel-schedule-430dcbc299034db99703ca83b8a27e89

- On load the site fetches that document (and again when the tab is focused and every minute); `localStorage` is
  only a cache. If the store is unreachable the cached / default schedule is shown with a Hebrew notice.
- On each edit the site re-reads the latest data, replays only your change on top of it and writes it back, so two
  admins editing different cells do not overwrite each other (same cell = last write wins).
- **The store is public and unauthenticated.** Anyone who knows the URL (it is in this repo and in the site's
  JavaScript) can read **and overwrite or erase** the schedule, and "כניסת מנהל" is open to every visitor. This is
  accepted on purpose ("no security needed"). There is no history or backup on the store's side; use **ייצוא** now and
  then to download a backup (`schedule-data.json`), and **ייבוא** to restore it (it replaces the shared data).
- textdb.dev is a small free hobby service with no uptime/retention guarantee. If it disappears, create a new key
  (`curl -X POST https://textdb.dev/api/data/<new-key> -H 'Content-Type: text/plain' -d '{"version":1,"upserts":[],"deletedIds":[]}'`)
  and change `SHARED_URL` in `static-site/overlay/lib/static-schedule.ts` (or build with
  `NEXT_PUBLIC_SHARED_URL=<url>`; an empty value turns sharing off and the site becomes read-only for edits made
  elsewhere: edits then only live in the browser cache).
- Note: the store only accepts `Content-Type: text/plain` posts from the browser without a charset suffix.

### Committing a fixed schedule (optional)

**ייצוא** downloads `schedule-data.json`. Put it in the repository root and commit to `main`: it becomes the base data
for every visitor (the shared edits still layer on top). Without it the site shows the demo data from `db/seed.ts`
(relative to the current week; an exported file has fixed dates).
