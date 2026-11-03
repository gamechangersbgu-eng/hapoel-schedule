# איך עובדים בפרויקט

| תחום | אחראי | branch | תיקייה |
|---|---|---|---|
| סקרייפינג מאתר ההתאחדות | עידן | `feature/scraper` | `services/scraper/` |
| אוטומציות והודעות | רז | `feature/notifications` | `services/notifications/` |
| מגרשים ואימונים | עומר ויוני | `feature/fields` | האפליקציה הקיימת (`app/`, `lib/`, `db/`) |
| תצוגה: טלפון וטלוויזיה | עומר ויוני | `feature/display` | `app/`, `components/` |

## כללים
1. כל אחד עובד ב-branch שלו ונוגע רק בתיקיות שלו, כדי שלא ייווצרו קונפליקטים.
2. `git pull origin main` פעם בכמה ימים כדי להישאר מעודכנים.
3. כשמשהו עובד: PR קטן ל-`main`. שינויים ב-`shared/` דורשים אישור של Omer.
4. מבנה הנתונים המשותף מוגדר ב-`shared/`. מסכימים עליו ביחד לפני שמתחילים.

## התחלה
```bash
git clone https://github.com/gamechangersbgu-eng/hapoel-schedule.git
cd hapoel-schedule
git checkout feature/<התחום-שלך>
```
