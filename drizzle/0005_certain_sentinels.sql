CREATE TABLE "framey_comment_like" (
	"userId" varchar(255) NOT NULL,
	"commentId" uuid NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	CONSTRAINT "framey_comment_like_userId_commentId_pk" PRIMARY KEY("userId","commentId")
);
--> statement-breakpoint
ALTER TABLE "framey_comment_like" ADD CONSTRAINT "framey_comment_like_userId_framey_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."framey_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "framey_comment_like" ADD CONSTRAINT "framey_comment_like_commentId_framey_post_comment_id_fk" FOREIGN KEY ("commentId") REFERENCES "public"."framey_post_comment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comment_like_comment_idx" ON "framey_comment_like" USING btree ("commentId");