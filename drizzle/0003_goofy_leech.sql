ALTER TABLE "framey_post" ADD COLUMN "locationId" varchar(32);--> statement-breakpoint
ALTER TABLE "framey_post" ADD COLUMN "locationLat" double precision;--> statement-breakpoint
ALTER TABLE "framey_post" ADD COLUMN "locationLng" double precision;--> statement-breakpoint
CREATE INDEX "post_location_idx" ON "framey_post" USING btree ("locationId","createdAt");