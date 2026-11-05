# Data architecture — Postgres + optional SQLite buffer

## System of record

**Postgres (Netlify Database)** is the canonical store for the hosted app, scraper output (after sync), and admin edits.

- Readers: home page (`getWeekData`), admin, TV/display, notifications service.
- Writers: admin server actions, IFA scraper (direct Postgres or via SQLite sync), one-way sync script.

## Optional SQLite buffer

**`data/local.db`** (gitignored) is for offline or manual batch edits on a laptop. It is **not** read by the Next.js app in production.

Flow: edit SQLite → run `npm run db:sync-local` → upserts into Postgres → `schedule_revision` bumps → web/TV see fresh data on refresh or poll.

Do **not** use a flat SQLite file as the only database for Netlify/serverless without hosted libSQL/Turso and a single write path.

## Real-time freshness (v1)

- Home page uses `dynamic = "force-dynamic"` (fresh DB read per navigation).
- **`schedule_revision`** (single row) increments on every schedule write.
- Clients poll **`GET /api/schedule/revision`** (e.g. every 45s on kiosk/TV) and call `router.refresh()` when `version` changes.

WebSockets / SSE are out of scope until sub-second TV updates are required.

See **`WRITE_CONTRACT.md`** for table-level write rules.
