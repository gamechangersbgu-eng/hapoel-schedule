# Scraper (עידן)

משיכת לוח המשחקים של קבוצות הנוער מאתר ההתאחדות ושמירתו ב-Postgres (מקור האמת).

עובדים רק בתיקייה הזו, ב-branch `feature/scraper`.

## חוזה כתיבה

ראו [`shared/WRITE_CONTRACT.md`](../../shared/WRITE_CONTRACT.md) ו-[`shared/ARCHITECTURE.md`](../../shared/ARCHITECTURE.md).

**יעד:** `slots` + `slot_game_details` (לא רoster / מגרשים).

**Upsert idempotent:** קרא ל-`upsertIfaGame()` מ-[`lib/ifa-game-upsert.ts`](../../lib/ifa-game-upsert.ts):

- `source`: `ifa_scraper` (`GAME_DETAIL_SOURCES.IFA_SCRAPER`)
- `external_id`: המפתח הקבוע שלנו (`key`), כי למשחקים עתידיים עדיין אין מזהה מההתאחדות
- `teamId`: מיפוי שם קבוצה → `teams.id`
- `type` / `gameKind`: `home_game` | `away_game`
- `date`, `startTime`, `opponent`, `kickoffTime`, `cityName` (אופציונלי — מחפש ב-`cities`)

אחרי ריצה מרובה: אפשר `{ bumpRevision: false }` לכל שורה ו-`bumpScheduleRevision()` פעם אחת בסוף.

כל הנתונים נשמרים ישירות ב-**Postgres** (Netlify Database).

## הרצה
מתיקיית השורש, אחרי `npm ci`:

```bash
npx tsx services/scraper/run.ts           # הרצה יבשה: קבצים ב-out/ ותוכנית ב-db-plan.json, בלי כתיבה למסד
npx tsx services/scraper/run.ts --write   # כתיבה למסד (נדרש NETLIFY_DATABASE_URL)
npx tsx --test services/scraper/scrape.test.ts   # בדיקות, בלי אתר ובלי מסד
```

## איך זה עובד
- משחקי הליגה מגיעים מעמוד כל המשחקים של כל קבוצה, ומשחקי הגביע מרשימת המועדון השבועית (`GetClubGames`).
- הבקשות נשלחות דרך `curl` עם User-Agent של דפדפן (באישור עומר), אחת אחרי השנייה, עם הפסקה של שנייה.
- נשמרים רק נתוני משחקים, בלי נתונים על שחקנים.
- כל כתיבה, לקבצים ולמסד, מתבצעת רק אחרי הרצה שהצליחה במלואה.
- `db-teams.ts` ממפה קבוצה באתר לשורה בלוח. קבוצה בלי שורה (`null`) מדולגת ומדווחת.
- הלוח הציבורי מציג רק שעה והערה, ולכן היריבה והמגרש נכתבים גם ל-`slots.note`.
- משחק שירד מהאתר לא נמחק מהמסד.

## הרצה אוטומטית
`.github/workflows/scraper.yml` כותב למסד פעמיים ביום, ודורש את הסוד `NETLIFY_DATABASE_URL` בריפו. לוח הזמנים מתחיל רק אחרי המיזוג ל-`main`. push ל-`feature/scraper` מריץ הרצה יבשה בלבד, והפעלה ידנית כותבת רק אם מסמנים `write`.

## בכל עונה חדשה
לעדכן את `SEASON_ID`, את טווח השבועות ואת רשימת הקבוצות ב-`teams.ts`, ואת המיפוי ב-`db-teams.ts`.
