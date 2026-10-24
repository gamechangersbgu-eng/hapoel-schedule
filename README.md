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

### Editing the schedule on the static site

1. Click **כניסת מנהל** (no username or password; it is just a switch in the browser, not security).
2. Click a cell to add, edit or delete a training / game / camp (same fields and validations as `/admin`).
   **העתק שבוע קודם** copies last week into the current one. Click **יציאה ממצב מנהל** to leave.
3. Edits are saved in the browser's `localStorage`, layered over the base data, so they survive reload.
   **אפס לברירת מחדל** removes all local edits.

Edits are visible **only in the browser where they were made** until you publish them:

### Publishing your edits for everyone

1. In admin mode click **ייצוא** (downloads `schedule-data.json`; **העתק JSON** copies it instead).
2. Put that file in the **root of the repository** as `schedule-data.json` (GitHub: *Add file → Upload files*,
   replacing the existing file) and commit to `main`.
3. The Pages workflow rebuilds (about a minute) and the file becomes the base data for every visitor.
   Visitors' own local edits (if any) still layer on top; **אפס לברירת מחדל** clears them.

To keep editing, open the site, enter admin mode, edit, export, and commit the new file again. **ייבוא**
loads a previously exported file into the browser (useful on another device).
Without a `schedule-data.json` the site shows the demo data from `db/seed.ts`.

Limitations: no real authentication (anyone can click **כניסת מנהל**, but their edits stay on their own device);
no shared live data, publishing is a manual commit; the demo data is relative to the current week while an
exported file has fixed dates.
