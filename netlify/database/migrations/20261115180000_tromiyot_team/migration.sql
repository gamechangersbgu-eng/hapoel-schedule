-- טרומיות: girls' pre-youth team, same pitch parts as ילדות א/ב (age band yeladot).
-- Inserts the calendar row only when the name is missing. Existing ids, names, slots,
-- and coach links stay as they are. sort_order of later rows moves down only on that insert.
INSERT INTO "team_age_bands" ("code", "label_he", "sort_order")
VALUES ('yeladot', 'ילדות א–ב', 3)
ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint
INSERT INTO "team_age_band_subdivisions" ("age_band_code", "subdivision_code")
SELECT v.age_band_code, v.subdivision_code
FROM (
  VALUES
    ('yeladot', 'whole'),
    ('yeladot', 'half_north'),
    ('yeladot', 'half_south'),
    ('yeladot', 'third_north'),
    ('yeladot', 'third_center'),
    ('yeladot', 'third_south'),
    ('yeladot', 'quarter_north_1'),
    ('yeladot', 'quarter_north_2'),
    ('yeladot', 'quarter_south_1'),
    ('yeladot', 'quarter_south_2')
) AS v(age_band_code, subdivision_code)
WHERE EXISTS (
  SELECT 1 FROM "pitch_subdivisions" s WHERE s."code" = v.subdivision_code
)
AND NOT EXISTS (
  SELECT 1 FROM "team_age_band_subdivisions" existing
  WHERE existing."age_band_code" = v.age_band_code
    AND existing."subdivision_code" = v.subdivision_code
);
--> statement-breakpoint
DO $$
DECLARE
  anchor integer;
BEGIN
  IF EXISTS (SELECT 1 FROM "teams" WHERE "name" = 'טרומיות') THEN
    RETURN;
  END IF;

  SELECT "sort_order" + 1 INTO anchor
  FROM "teams"
  WHERE "name" = 'ילדות ב'
  ORDER BY "id"
  LIMIT 1;

  IF anchor IS NULL THEN
    SELECT MIN("sort_order") INTO anchor
    FROM "teams"
    WHERE "name" IN ('בית ספר', 'בית ספר לכדורגל', 'הערות');
  END IF;

  IF anchor IS NULL THEN
    SELECT COALESCE(MAX("sort_order"), 0) + 1 INTO anchor FROM "teams";
  END IF;

  UPDATE "teams" SET "sort_order" = "sort_order" + 1 WHERE "sort_order" >= anchor;
  INSERT INTO "teams" ("name", "sort_order", "is_comments", "age_band_code")
  VALUES ('טרומיות', anchor, false, 'yeladot');
END $$;
