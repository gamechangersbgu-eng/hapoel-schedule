-- Opponent club → city, so away games can take the city from the opponent name.
-- Seed: every distinct opponent already on a game. City: longest city-name contained
-- in the opponent (quotes and dashes ignored), same rule as lib/opponent-city-match.ts.
-- Away games with no city are filled from that match. Idempotent.
CREATE TABLE IF NOT EXISTS "opponent_clubs" (
  "id" serial PRIMARY KEY,
  "name" text NOT NULL,
  "city_id" integer,
  "created_at" text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "opponent_clubs_name_idx" ON "opponent_clubs" ("name");
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "opponent_clubs"
    ADD CONSTRAINT "opponent_clubs_city_id_cities_id_fkey"
    FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
INSERT INTO "opponent_clubs" ("name", "city_id", "created_at")
SELECT DISTINCT btrim(d."opponent"), NULL::integer, '2026-11-10T00:00:00.000Z'
FROM "slot_game_details" d
WHERE d."opponent" IS NOT NULL
  AND btrim(d."opponent") <> ''
  AND NOT EXISTS (
    SELECT 1 FROM "opponent_clubs" existing WHERE existing."name" = btrim(d."opponent")
  );
--> statement-breakpoint
UPDATE "opponent_clubs" club
SET "city_id" = matched.city_id
FROM (
  SELECT DISTINCT ON (club."id") club."id" AS opponent_id, city."id" AS city_id
  FROM "opponent_clubs" club
  JOIN "cities" city
    ON char_length(btrim(city."name")) >= 2
   AND position(
        regexp_replace(
          regexp_replace(
            regexp_replace(btrim(city."name"), '["״׳'']', '', 'g'),
            '[-–—]', ' ', 'g'
          ),
          '\s+', ' ', 'g'
        )
        IN
        regexp_replace(
          regexp_replace(
            regexp_replace(club."name", '["״׳'']', '', 'g'),
            '[-–—]', ' ', 'g'
          ),
          '\s+', ' ', 'g'
        )
      ) > 0
  WHERE club."city_id" IS NULL
  ORDER BY club."id", char_length(btrim(city."name")) DESC, city."id"
) matched
WHERE club."id" = matched.opponent_id
  AND club."city_id" IS NULL;
--> statement-breakpoint
UPDATE "slot_game_details" game
SET "city_id" = club."city_id"
FROM "slots" slot, "opponent_clubs" club
WHERE game."slot_id" = slot."id"
  AND slot."type" = 'away_game'
  AND game."city_id" IS NULL
  AND game."opponent" IS NOT NULL
  AND club."name" = btrim(game."opponent")
  AND club."city_id" IS NOT NULL;
