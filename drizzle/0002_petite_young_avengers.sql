ALTER TABLE "framey_account" DROP CONSTRAINT "framey_account_userId_framey_user_id_fk";
--> statement-breakpoint
ALTER TABLE "framey_session" DROP CONSTRAINT "framey_session_userId_framey_user_id_fk";
--> statement-breakpoint
ALTER TABLE "framey_account" ADD CONSTRAINT "framey_account_userId_framey_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."framey_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "framey_session" ADD CONSTRAINT "framey_session_userId_framey_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."framey_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "framey_user" DROP COLUMN "slug";