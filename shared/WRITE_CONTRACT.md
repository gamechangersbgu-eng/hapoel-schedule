# Schedule write contract

All modules that change the **public week grid** must update Postgres and bump revision.

## Read path (unchanged)

```
app/page.tsx → getWeekData(week) → settings + teams + slots
```

No join to extension tables is required for the grid to render.

## Writers

| Writer | Tables | After write |
|--------|--------|-------------|
| Admin (`app/actions.ts`) | `slots` | `bumpScheduleRevision()` + `revalidatePath` |
| IFA scraper (`services/scraper/`) | `slots`, `slot_game_details` | `bumpScheduleRevision()` |
| SQLite sync (`scripts/sync-local-sqlite.ts`) | same as scraper | `bumpScheduleRevision()` |

Roster / pitch reference data (`players`, `pitches`, …) does **not** bump revision unless you later tie them to the grid.

## Slot invariants

- `date`: ISO `YYYY-MM-DD`
- `startTime`: `HH:MM` or null (pitch slots require time)
- `type`: must match `lib/slot-types.ts` ids for UI colors
- Games: `type` is `home_game` or `away_game`; details in `slot_game_details`

## Idempotent game upserts (scraper)

Use **`source`** + **`external_id`** on `slot_game_details`:

- `source`: `ifa_scraper` (constant `GAME_DETAIL_SOURCES.IFA_SCRAPER` in `shared/game.ts`)
- `external_id`: stable IFA fixture id string

Upsert strategy:

1. Find existing detail by `(source, external_id)`.
2. If found, update linked `slots` row + detail fields.
3. Else insert `slots` then `slot_game_details` with keys set.

Fallback match when no external id yet: `(team_id, date, type)` on `slots` for that team.

## Manual SQLite buffer

Local table shapes mirror `slots` + `slot_game_details` (see `scripts/sqlite-buffer.ts`). Team ids must match Postgres `teams.id` (seed first).
