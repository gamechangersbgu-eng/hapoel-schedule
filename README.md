# Hapoel Schedule

A Hebrew youth-football schedule management app for Hapoel Be'er Sheva.

## Stack

- Next.js 16 / React 19
- TypeScript
- Drizzle ORM
- **Postgres (Netlify Database)** — the only database for the live app
- Netlify for the hosted version

## Database (Postgres)

All schedule, team, pitch, and game data lives in **one Postgres database** (Netlify Database in production; the same via `netlify dev` locally).

| What | Where |
|------|--------|
| Schema | `db/schema/` (team, pitch, practice, game domains) |
| Migrations | `netlify/database/migrations/` |
| Demo / synthetic data | `db/seed.ts` — **two weeks** of practices and games from the current Sunday |
| Shared contract | `shared/` (+ `ARCHITECTURE.md`, `WRITE_CONTRACT.md`) |

There is **no** SQLite, textdb, or in-browser store for the Netlify app. The GitHub Pages static build (below) is a separate legacy demo without Postgres.

### Create Postgres and apply schema

**On Netlify (production / preview)**

1. In the Netlify site dashboard, enable **Netlify DB** (or connect the Neon extension) for this site.
2. Deploy from `main` (or merge PR with migrations). Netlify injects the connection automatically — no manual URL in the repo.
3. After the first deploy with DB enabled, run migrations and seed from your machine (linked to the site):

```bash
npm ci
npx netlify link          # if not linked
npx netlify dev:exec -- npm run db:migrate
npx netlify dev:exec -- npm run db:seed
```

**Locally**

```bash
npm ci
npm run dev:local         # starts netlify dev with local Postgres
# In another terminal, with netlify env available:
npx netlify dev:exec -- npm run db:migrate
npx netlify dev:exec -- npm run db:seed
```

`npm run db:seed` clears schedule rows and loads synthetic **practices** (מגרשים) and **games** (בית/חוץ with `slot_game_details`) for **14 days** ahead of the current week’s Sunday, plus reference data (pitches, cities, demo medics/drivers, players).

### Useful database commands

```bash
npm run db:migrate   # Apply Drizzle migrations to Postgres
npm run db:seed      # Reset demo schedule + reference data (two weeks)
npm run db:generate  # Generate SQL after schema changes (developers)
```

## Team and responsibilities

| Who | Area | Branch | Folder |
|---|---|---|---|
| Idan Keren ([@idankeren15-art](https://github.com/idankeren15-art)) | Scraping the match schedule from the Israel Football Association website | `feature/scraper` | `services/scraper/` |
| Raz Weisblech ([@razweis](https://github.com/razweis)) | Automations and notifications to players and parents | `feature/notifications` | `services/notifications/` |
| Omer Ben ([@gamechangersbgu-eng](https://github.com/gamechangersbgu-eng)) | Fields and training management | `feature/fields` | `app/`, `components/`, `lib/` |
| Yoni Mark ([@yonimarc](https://github.com/yonimarc)) | Display: mobile view and club TV screen | `feature/display` | `app/`, `components/` |

The shared data structure lives in `shared/`; changes there need Omer's approval. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Open locally

Requirements: Node.js 22, Git, Netlify CLI (for database).

```bash
git clone https://github.com/gamechangersbgu-eng/hapoel-schedule.git
cd hapoel-schedule
npm ci
npm run dev:local
```

Open the URL printed by Netlify CLI (usually `http://localhost:8888`). Run migrations and seed as above before the first use.

Do **not** start with `npm start` until you have run `npm run build`.

## Useful commands

```bash
npm run dev:local   # Recommended local development (Postgres via Netlify)
npm run build       # Production build
npm start           # Run an already-built production app
npm run lint        # Lint
npm run db:migrate  # Apply migrations
npm run db:seed     # Two weeks of synthetic schedule data
```

## Project structure

- `app/` — Next.js pages, API (`/api/schedule/revision`), server actions
- `components/` — UI (`ScheduleLiveRefresh` polls for scraper/admin updates)
- `db/` — Drizzle schema, seed, two-week demo definitions
- `lib/` — schedule helpers, IFA upsert, revision bump
- `netlify/database/migrations/` — Postgres migrations
- `services/scraper/` — IFA scraper (writes Postgres)
- `shared/` — cross-module types and write contract

## Admin and public schedule

- Public week grid: `/`
- Admin editor: `/admin`

The home page reads `settings`, `teams`, and `slots` for the selected week (`getWeekData`). It refreshes when `schedule_revision` changes (navigation or ~45s poll).

## Important

Do not commit real credentials. Connection strings are provided by Netlify at runtime.

## Legacy: static site on GitHub Pages

`npm run build:pages` builds a **non-Postgres** static copy for GitHub Pages (textdb.dev overlay). It is **not** the Hapoel management database path. See `static-site/` and the long comment block in git history if you still maintain that demo.
