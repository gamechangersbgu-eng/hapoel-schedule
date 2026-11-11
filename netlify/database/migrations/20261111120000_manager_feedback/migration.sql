-- Manager feedback (Nov 2026). Idempotent: safe to run more than once.
-- Does not delete or rename existing teams, so schedule rows stay on the same ids.
-- 1. Official training length: 90 minutes (שעה וחצי), beside 60 / 105 / 120.
-- 2. Management contacts receive every team's updates (same staff phone/email as coaches).
-- 3. Calendar rows that were missing: ילדים א שחר, טרום ג עבדאללה, ילדות א, ילדות ב.
-- 4. Israeli ID (ת"ז) on the medic and driver banks. Admin only; not selected by the public snapshot.

INSERT INTO "training_session_durations" ("minutes", "label_he")
SELECT 90, 'שעה וחצי'
WHERE NOT EXISTS (
  SELECT 1 FROM "training_session_durations" WHERE "minutes" = 90
);
--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "receives_all_updates" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "medics" ADD COLUMN IF NOT EXISTS "national_id" text;
--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "national_id" text;
--> statement-breakpoint
INSERT INTO "team_age_bands" ("code", "label_he", "sort_order")
VALUES
  ('noar_through_yeladim_b', 'נוער עד ילדים ב', 0),
  ('yeladim_g_through_trum_g', 'ילדים ג עד טרום ג', 1)
ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint
-- New group only when that exact name is missing AND no team in the age group
-- is already coached by someone whose given name is שחר (the screen then shows "ילדים א שחר").
INSERT INTO "teams" ("name", "sort_order", "is_comments", "age_band_code")
SELECT
  'ילדים א שחר',
  COALESCE(
    (SELECT MIN(t."sort_order") FROM "teams" t WHERE t."name" = 'ילדים א' OR t."name" LIKE 'ילדים א %'),
    4
  ),
  false,
  'noar_through_yeladim_b'
WHERE NOT EXISTS (SELECT 1 FROM "teams" WHERE "name" = 'ילדים א שחר')
  AND NOT EXISTS (
    SELECT 1
    FROM "teams" t
    JOIN "team_coaches" tc ON tc."team_id" = t."id"
    LEFT JOIN "staff" s ON s."id" = tc."staff_id"
    WHERE (t."name" = 'ילדים א' OR t."name" LIKE 'ילדים א %')
      AND (
        split_part(btrim(tc."coach_name"), ' ', 1) = 'שחר'
        OR split_part(btrim(COALESCE(s."display_name", '')), ' ', 1) = 'שחר'
      )
  );
--> statement-breakpoint
INSERT INTO "teams" ("name", "sort_order", "is_comments", "age_band_code")
SELECT
  'טרום ג עבדאללה',
  COALESCE(
    (SELECT MIN(t."sort_order") FROM "teams" t WHERE t."name" = 'טרום ג' OR t."name" LIKE 'טרום ג %'),
    13
  ),
  false,
  'yeladim_g_through_trum_g'
WHERE NOT EXISTS (SELECT 1 FROM "teams" WHERE "name" = 'טרום ג עבדאללה')
  AND NOT EXISTS (
    SELECT 1
    FROM "teams" t
    JOIN "team_coaches" tc ON tc."team_id" = t."id"
    LEFT JOIN "staff" s ON s."id" = tc."staff_id"
    WHERE (t."name" = 'טרום ג' OR t."name" LIKE 'טרום ג %')
      AND (
        split_part(btrim(tc."coach_name"), ' ', 1) = 'עבדאללה'
        OR split_part(btrim(COALESCE(s."display_name", '')), ' ', 1) = 'עבדאללה'
      )
  );
--> statement-breakpoint
-- ילדות א / ילדות ב sit just before the football-school row. Existing ids and names are untouched;
-- only sort_order of the school row and anything after it moves down to make room, and only when inserting.
DO $$
DECLARE
  anchor integer;
BEGIN
  IF EXISTS (SELECT 1 FROM "teams" WHERE "name" = 'ילדות א')
     AND EXISTS (SELECT 1 FROM "teams" WHERE "name" = 'ילדות ב') THEN
    RETURN;
  END IF;

  SELECT MIN("sort_order") INTO anchor
  FROM "teams"
  WHERE "name" IN ('בית ספר', 'בית ספר לכדורגל');

  IF anchor IS NULL THEN
    SELECT COALESCE(MAX("sort_order"), 0) + 1 INTO anchor FROM "teams";
  END IF;

  IF NOT EXISTS (SELECT 1 FROM "teams" WHERE "name" = 'ילדות א') THEN
    UPDATE "teams" SET "sort_order" = "sort_order" + 1 WHERE "sort_order" >= anchor;
    INSERT INTO "teams" ("name", "sort_order", "is_comments", "age_band_code")
    VALUES ('ילדות א', anchor, false, 'noar_through_yeladim_b');
    anchor := anchor + 1;
  ELSE
    SELECT "sort_order" + 1 INTO anchor FROM "teams" WHERE "name" = 'ילדות א' ORDER BY "id" LIMIT 1;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM "teams" WHERE "name" = 'ילדות ב') THEN
    UPDATE "teams" SET "sort_order" = "sort_order" + 1 WHERE "sort_order" >= anchor;
    INSERT INTO "teams" ("name", "sort_order", "is_comments", "age_band_code")
    VALUES ('ילדות ב', anchor, false, 'noar_through_yeladim_b');
  END IF;
END $$;
