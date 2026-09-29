CREATE TABLE "framey_post_repost" (
	"postId" uuid NOT NULL,
	"userId" varchar(255) NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	CONSTRAINT "framey_post_repost_postId_userId_pk" PRIMARY KEY("postId","userId")
);
--> statement-breakpoint
CREATE TABLE "framey_story_like" (
	"storyId" uuid NOT NULL,
	"userId" varchar(255) NOT NULL,
	CONSTRAINT "framey_story_like_storyId_userId_pk" PRIMARY KEY("storyId","userId")
);
--> statement-breakpoint
ALTER TABLE "framey_message" ADD COLUMN "storyId" uuid;--> statement-breakpoint
ALTER TABLE "framey_post_repost" ADD CONSTRAINT "framey_post_repost_postId_framey_post_id_fk" FOREIGN KEY ("postId") REFERENCES "public"."framey_post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "framey_post_repost" ADD CONSTRAINT "framey_post_repost_userId_framey_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."framey_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "framey_story_like" ADD CONSTRAINT "framey_story_like_storyId_framey_story_id_fk" FOREIGN KEY ("storyId") REFERENCES "public"."framey_story"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "framey_story_like" ADD CONSTRAINT "framey_story_like_userId_framey_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."framey_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "post_repost_user_idx" ON "framey_post_repost" USING btree ("userId","createdAt");--> statement-breakpoint
ALTER TABLE "framey_message" ADD CONSTRAINT "framey_message_storyId_framey_story_id_fk" FOREIGN KEY ("storyId") REFERENCES "public"."framey_story"("id") ON DELETE set null ON UPDATE no action;