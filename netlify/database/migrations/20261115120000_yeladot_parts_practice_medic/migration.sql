-- Practice games (משחק אימון) store a free-text medic next to the existing opponent column.
-- League games keep medic_id. Existing rows stay null. Safe to run again.
ALTER TABLE "slot_game_details" ADD COLUMN IF NOT EXISTS "medic_name" text;
--> statement-breakpoint
-- ילדות א / ילדות ב may book a third or a quarter in addition to a whole pitch and a half.
-- Other teams on נוער–ילדים ב stay on whole/half. No schedule rows are deleted or rewritten.
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
UPDATE "teams"
SET "age_band_code" = 'yeladot'
WHERE "name" IN ('ילדות א', 'ילדות ב')
  AND "age_band_code" IS DISTINCT FROM 'yeladot';
