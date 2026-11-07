# Data architecture — Postgres only

## System of record

**Postgres (Netlify Database)** is the **only** database for the live app, scraper, admin, notifications, and display.

- All tables live in one Postgres instance (Drizzle schema under `db/schema/`).
- Readers: home page (`getWeekData`), admin, TV/display, `services/notifications`, `services/scraper`.
- Writers: admin server actions, IFA scraper (`upsertIfaGame`), seed script (`npm run db:seed`).

There is no parallel SQLite or static JSON store for the Netlify deployment.

## Real-time freshness (v1)

- Home page uses `dynamic = "force-dynamic"` (fresh DB read per navigation).
- **`schedule_revision`** increments on every schedule write.
- Clients poll **`GET /api/schedule/revision`** (e.g. every 45s on kiosk/TV) and call `router.refresh()` when `version` changes.

See **`WRITE_CONTRACT.md`** for table-level write rules.

## GitHub Pages static site

The optional GitHub Pages build (`npm run build:pages`) is a **legacy demo** without Postgres. It is not the production data path for Hapoel management.
