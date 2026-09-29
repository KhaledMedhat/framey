CREATE TABLE "framey_follow_request" (
	"requesterId" varchar(255) NOT NULL,
	"targetId" varchar(255) NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	CONSTRAINT "framey_follow_request_requesterId_targetId_pk" PRIMARY KEY("requesterId","targetId")
);
--> statement-breakpoint
CREATE TABLE "framey_highlight_story" (
	"highlightId" uuid NOT NULL,
	"storyId" uuid NOT NULL,
	CONSTRAINT "framey_highlight_story_highlightId_storyId_pk" PRIMARY KEY("highlightId","storyId")
);
--> statement-breakpoint
CREATE TABLE "framey_highlight" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" varchar(255) NOT NULL,
	"title" varchar(30) NOT NULL,
	"createdAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "framey_notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" varchar(255) NOT NULL,
	"actorId" varchar(255) NOT NULL,
	"type" varchar(32) NOT NULL,
	"postId" uuid,
	"commentId" uuid,
	"read" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "framey_saved_collection_post" (
	"collectionId" uuid NOT NULL,
	"postId" uuid NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	CONSTRAINT "framey_saved_collection_post_collectionId_postId_pk" PRIMARY KEY("collectionId","postId")
);
--> statement-breakpoint
CREATE TABLE "framey_saved_collection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" varchar(255) NOT NULL,
	"name" varchar(50) NOT NULL,
	"createdAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "framey_saved_post" (
	"userId" varchar(255) NOT NULL,
	"postId" uuid NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	CONSTRAINT "framey_saved_post_userId_postId_pk" PRIMARY KEY("userId","postId")
);
--> statement-breakpoint
CREATE TABLE "framey_story" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"authorId" varchar(255) NOT NULL,
	"url" text NOT NULL,
	"key" varchar(512),
	"type" varchar(128),
	"width" integer,
	"height" integer,
	"cover" jsonb,
	"muted" boolean DEFAULT false NOT NULL,
	"duration" double precision,
	"createdAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "framey_story_view" (
	"storyId" uuid NOT NULL,
	"viewerId" varchar(255) NOT NULL,
	CONSTRAINT "framey_story_view_storyId_viewerId_pk" PRIMARY KEY("storyId","viewerId")
);
--> statement-breakpoint
ALTER TABLE "framey_post" ADD COLUMN "archivedAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "framey_follow_request" ADD CONSTRAINT "framey_follow_request_requesterId_framey_user_id_fk" FOREIGN KEY ("requesterId") REFERENCES "public"."framey_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "framey_follow_request" ADD CONSTRAINT "framey_follow_request_targetId_framey_user_id_fk" FOREIGN KEY ("targetId") REFERENCES "public"."framey_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "framey_highlight_story" ADD CONSTRAINT "framey_highlight_story_highlightId_framey_highlight_id_fk" FOREIGN KEY ("highlightId") REFERENCES "public"."framey_highlight"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "framey_highlight_story" ADD CONSTRAINT "framey_highlight_story_storyId_framey_story_id_fk" FOREIGN KEY ("storyId") REFERENCES "public"."framey_story"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "framey_highlight" ADD CONSTRAINT "framey_highlight_userId_framey_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."framey_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "framey_notification" ADD CONSTRAINT "framey_notification_userId_framey_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."framey_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "framey_notification" ADD CONSTRAINT "framey_notification_actorId_framey_user_id_fk" FOREIGN KEY ("actorId") REFERENCES "public"."framey_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "framey_notification" ADD CONSTRAINT "framey_notification_postId_framey_post_id_fk" FOREIGN KEY ("postId") REFERENCES "public"."framey_post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "framey_notification" ADD CONSTRAINT "framey_notification_commentId_framey_post_comment_id_fk" FOREIGN KEY ("commentId") REFERENCES "public"."framey_post_comment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "framey_saved_collection_post" ADD CONSTRAINT "framey_saved_collection_post_collectionId_framey_saved_collection_id_fk" FOREIGN KEY ("collectionId") REFERENCES "public"."framey_saved_collection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "framey_saved_collection_post" ADD CONSTRAINT "framey_saved_collection_post_postId_framey_post_id_fk" FOREIGN KEY ("postId") REFERENCES "public"."framey_post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "framey_saved_collection" ADD CONSTRAINT "framey_saved_collection_userId_framey_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."framey_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "framey_saved_post" ADD CONSTRAINT "framey_saved_post_userId_framey_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."framey_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "framey_saved_post" ADD CONSTRAINT "framey_saved_post_postId_framey_post_id_fk" FOREIGN KEY ("postId") REFERENCES "public"."framey_post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "framey_story" ADD CONSTRAINT "framey_story_authorId_framey_user_id_fk" FOREIGN KEY ("authorId") REFERENCES "public"."framey_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "framey_story_view" ADD CONSTRAINT "framey_story_view_storyId_framey_story_id_fk" FOREIGN KEY ("storyId") REFERENCES "public"."framey_story"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "framey_story_view" ADD CONSTRAINT "framey_story_view_viewerId_framey_user_id_fk" FOREIGN KEY ("viewerId") REFERENCES "public"."framey_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "follow_request_target_idx" ON "framey_follow_request" USING btree ("targetId");--> statement-breakpoint
CREATE INDEX "highlight_user_idx" ON "framey_highlight" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "notification_user_idx" ON "framey_notification" USING btree ("userId","createdAt");--> statement-breakpoint
CREATE INDEX "saved_collection_post_post_idx" ON "framey_saved_collection_post" USING btree ("postId");--> statement-breakpoint
CREATE INDEX "saved_collection_user_idx" ON "framey_saved_collection" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "saved_post_post_idx" ON "framey_saved_post" USING btree ("postId");--> statement-breakpoint
CREATE INDEX "story_author_idx" ON "framey_story" USING btree ("authorId","createdAt");