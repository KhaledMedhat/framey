CREATE TABLE "framey_account_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" varchar(255) NOT NULL,
	"kind" varchar(32) NOT NULL,
	"value" text,
	"createdAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "framey_story" ADD COLUMN "overlays" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "framey_story" ADD COLUMN "repostOfId" uuid;--> statement-breakpoint
ALTER TABLE "framey_story" ADD COLUMN "repostOfUserId" varchar(255);--> statement-breakpoint
ALTER TABLE "framey_account_event" ADD CONSTRAINT "framey_account_event_userId_framey_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."framey_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_event_user_idx" ON "framey_account_event" USING btree ("userId","createdAt");--> statement-breakpoint
ALTER TABLE "framey_story" ADD CONSTRAINT "framey_story_repostOfId_framey_story_id_fk" FOREIGN KEY ("repostOfId") REFERENCES "public"."framey_story"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "framey_story" ADD CONSTRAINT "framey_story_repostOfUserId_framey_user_id_fk" FOREIGN KEY ("repostOfUserId") REFERENCES "public"."framey_user"("id") ON DELETE set null ON UPDATE no action;