CREATE TABLE "framey_account" (
	"userId" varchar(255) NOT NULL,
	"type" varchar(255) NOT NULL,
	"provider" varchar(255) NOT NULL,
	"providerAccountId" varchar(255) NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" varchar(255),
	"scope" varchar(255),
	"id_token" text,
	"session_state" varchar(255),
	CONSTRAINT "framey_account_provider_providerAccountId_pk" PRIMARY KEY("provider","providerAccountId")
);
--> statement-breakpoint
CREATE TABLE "framey_post_collaborator" (
	"postId" uuid NOT NULL,
	"userId" varchar(255) NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	CONSTRAINT "framey_post_collaborator_postId_userId_pk" PRIMARY KEY("postId","userId")
);
--> statement-breakpoint
CREATE TABLE "framey_post_comment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"postId" uuid NOT NULL,
	"authorId" varchar(255) NOT NULL,
	"parentId" uuid,
	"content" text NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "framey_post_like" (
	"userId" varchar(255) NOT NULL,
	"postId" uuid NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	CONSTRAINT "framey_post_like_userId_postId_pk" PRIMARY KEY("userId","postId")
);
--> statement-breakpoint
CREATE TABLE "framey_post_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"postId" uuid NOT NULL,
	"url" text NOT NULL,
	"type" varchar(128),
	"size" integer,
	"key" varchar(512),
	"width" integer,
	"height" integer,
	"alt" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cover" jsonb,
	"muted" boolean DEFAULT false NOT NULL,
	"duration" double precision,
	"trimStart" double precision,
	"trimEnd" double precision,
	"order" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "framey_post" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"authorId" varchar(255) NOT NULL,
	"caption" text,
	"location" varchar(512),
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"hideComments" boolean DEFAULT false NOT NULL,
	"hidePostInfo" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "framey_session" (
	"sessionToken" varchar(255) PRIMARY KEY NOT NULL,
	"userId" varchar(255) NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "framey_user_follow" (
	"followerId" varchar(255) NOT NULL,
	"followingId" varchar(255) NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	CONSTRAINT "framey_user_follow_followerId_followingId_pk" PRIMARY KEY("followerId","followingId")
);
--> statement-breakpoint
CREATE TABLE "framey_user" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"firstName" varchar(255) NOT NULL,
	"lastName" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"username" varchar(255) NOT NULL,
	"bio" text,
	"gender" varchar(255),
	"dateOfBirth" timestamp with time zone,
	"password" varchar(255),
	"emailVerified" timestamp with time zone,
	"profilePicture" jsonb,
	"profileComplete" boolean DEFAULT false NOT NULL,
	"visibility" varchar(32) DEFAULT 'public' NOT NULL,
	"slug" varchar(255) DEFAULT '@me',
	CONSTRAINT "framey_user_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "framey_verification_token" (
	"identifier" varchar(255) NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "framey_verification_token_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "framey_account" ADD CONSTRAINT "framey_account_userId_framey_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."framey_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "framey_post_collaborator" ADD CONSTRAINT "framey_post_collaborator_postId_framey_post_id_fk" FOREIGN KEY ("postId") REFERENCES "public"."framey_post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "framey_post_collaborator" ADD CONSTRAINT "framey_post_collaborator_userId_framey_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."framey_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "framey_post_comment" ADD CONSTRAINT "framey_post_comment_postId_framey_post_id_fk" FOREIGN KEY ("postId") REFERENCES "public"."framey_post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "framey_post_comment" ADD CONSTRAINT "framey_post_comment_authorId_framey_user_id_fk" FOREIGN KEY ("authorId") REFERENCES "public"."framey_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "framey_post_comment" ADD CONSTRAINT "framey_post_comment_parentId_framey_post_comment_id_fk" FOREIGN KEY ("parentId") REFERENCES "public"."framey_post_comment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "framey_post_like" ADD CONSTRAINT "framey_post_like_userId_framey_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."framey_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "framey_post_like" ADD CONSTRAINT "framey_post_like_postId_framey_post_id_fk" FOREIGN KEY ("postId") REFERENCES "public"."framey_post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "framey_post_media" ADD CONSTRAINT "framey_post_media_postId_framey_post_id_fk" FOREIGN KEY ("postId") REFERENCES "public"."framey_post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "framey_post" ADD CONSTRAINT "framey_post_authorId_framey_user_id_fk" FOREIGN KEY ("authorId") REFERENCES "public"."framey_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "framey_session" ADD CONSTRAINT "framey_session_userId_framey_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."framey_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "framey_user_follow" ADD CONSTRAINT "framey_user_follow_followerId_framey_user_id_fk" FOREIGN KEY ("followerId") REFERENCES "public"."framey_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "framey_user_follow" ADD CONSTRAINT "framey_user_follow_followingId_framey_user_id_fk" FOREIGN KEY ("followingId") REFERENCES "public"."framey_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "framey_account" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "post_collaborator_post_idx" ON "framey_post_collaborator" USING btree ("postId");--> statement-breakpoint
CREATE INDEX "post_collaborator_user_idx" ON "framey_post_collaborator" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "post_comment_post_idx" ON "framey_post_comment" USING btree ("postId");--> statement-breakpoint
CREATE INDEX "post_comment_author_idx" ON "framey_post_comment" USING btree ("authorId");--> statement-breakpoint
CREATE INDEX "post_comment_parent_idx" ON "framey_post_comment" USING btree ("parentId");--> statement-breakpoint
CREATE INDEX "post_like_user_idx" ON "framey_post_like" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "post_like_post_idx" ON "framey_post_like" USING btree ("postId");--> statement-breakpoint
CREATE INDEX "post_media_post_idx" ON "framey_post_media" USING btree ("postId");--> statement-breakpoint
CREATE INDEX "post_author_idx" ON "framey_post" USING btree ("authorId");--> statement-breakpoint
CREATE INDEX "post_created_at_idx" ON "framey_post" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "t_user_id_idx" ON "framey_session" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "user_follow_follower_idx" ON "framey_user_follow" USING btree ("followerId");--> statement-breakpoint
CREATE INDEX "user_follow_following_idx" ON "framey_user_follow" USING btree ("followingId");--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_idx" ON "framey_user" USING btree ("email");