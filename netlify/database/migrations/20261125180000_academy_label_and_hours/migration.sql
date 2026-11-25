-- Rename the football-school labels to אקדמיה לכדורגל and allow its extra hours.
-- Row ids, age-band code football_school, and existing schedule rows stay.
-- 4 hours is a stored duration. טורניר/ליגה is a session kind with a free length.

UPDATE "teams"
SET "name" = 'אקדמיה לכדורגל'
WHERE "name" IN ('בית ספר', 'בית ספר לכדורגל', 'בית הספר לכדורגל');
--> statement-breakpoint
UPDATE "team_age_bands"
SET "label_he" = 'אקדמיה לכדורגל'
WHERE "code" = 'football_school';
--> statement-breakpoint
INSERT INTO "training_session_durations" ("minutes", "label_he")
VALUES (240, '4 שעות')
ON CONFLICT ("minutes") DO UPDATE SET "label_he" = EXCLUDED."label_he";
--> statement-breakpoint
ALTER TABLE "slot_training_details"
  ADD COLUMN IF NOT EXISTS "session_kind" text NOT NULL DEFAULT 'training';
--> statement-breakpoint
UPDATE "slot_training_details"
SET "session_kind" = 'training'
WHERE "session_kind" IS NULL OR "session_kind" NOT IN ('training', 'tournament');
