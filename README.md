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
