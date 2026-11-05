# Scraper (עידן)

משיכת לוח המשחקים של קבוצות הנוער מאתר ההתאחדות ושמירתו ב-Postgres (מקור האמת).

עובדים רק בתיקייה הזו, ב-branch `feature/scraper`.

## חוזה כתיבה

ראו [`shared/WRITE_CONTRACT.md`](../../shared/WRITE_CONTRACT.md) ו-[`shared/ARCHITECTURE.md`](../../shared/ARCHITECTURE.md).

**יעד:** `slots` + `slot_game_details` (לא רoster / מגרשים).

**Upsert idempotent:** קרא ל-`upsertIfaGame()` מ-[`lib/ifa-game-upsert.ts`](../../lib/ifa-game-upsert.ts):

- `source`: `ifa_scraper` (`GAME_DETAIL_SOURCES.IFA_SCRAPER`)
- `external_id`: מזהה קבוע מההתאחדות לכל משחק
- `teamId`: מיפוי שם קבוצה → `teams.id`
- `type` / `gameKind`: `home_game` | `away_game`
- `date`, `startTime`, `opponent`, `kickoffTime`, `cityName` (אופציונלי — מחפש ב-`cities`)

אחרי ריצה מרובה: אפשר `{ bumpRevision: false }` לכל שורה ו-`bumpScheduleRevision()` פעם אחת בסוף.

**אלטרנטיבה:** כתיבה ל-`data/local.db` (SQLite) ואז `npm run db:sync-local` מהמחשב המקומי.
