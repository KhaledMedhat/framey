ALTER TABLE "framey_user" ADD COLUMN "websites" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
-- Carry the one website over as the first of the list.
UPDATE "framey_user" SET "websites" = jsonb_build_array("website") WHERE "website" IS NOT NULL AND "website" <> '';
