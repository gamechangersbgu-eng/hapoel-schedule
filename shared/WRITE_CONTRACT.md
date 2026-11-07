# Schedule write contract

All modules that change the **public week grid** must write **Postgres** and bump revision.

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
| Seed (`npm run db:seed`) | all demo tables | `ensureScheduleRevision()` |

Roster / pitch reference data does not bump revision unless tied to the grid.

## Slot invariants

- `date`: ISO `YYYY-MM-DD`
- `startTime`: `HH:MM` or null (pitch slots require time)
- `type`: must match `lib/slot-types.ts` ids for UI colors
- Games: `type` is `home_game` or `away_game`; details in `slot_game_details`

## Idempotent game upserts (scraper)

Use **`source`** + **`external_id`** on `slot_game_details`:

- `source`: `ifa_scraper` (`GAME_DETAIL_SOURCES.IFA_SCRAPER`)
- `external_id`: stable IFA fixture id string

Upsert via `lib/ifa-game-upsert.ts`.

Fallback match when no external id: `(team_id, date, type)` on `slots`.
