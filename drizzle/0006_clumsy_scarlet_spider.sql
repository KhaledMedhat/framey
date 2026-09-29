CREATE TABLE "framey_close_friend" (
	"userId" varchar(255) NOT NULL,
	"friendId" varchar(255) NOT NULL,
	CONSTRAINT "framey_close_friend_userId_friendId_pk" PRIMARY KEY("userId","friendId")
);
--> statement-breakpoint
CREATE TABLE "framey_user_block" (
	"blockerId" varchar(255) NOT NULL,
	"blockedId" varchar(255) NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	CONSTRAINT "framey_user_block_blockerId_blockedId_pk" PRIMARY KEY("blockerId","blockedId")
);
--> statement-breakpoint
ALTER TABLE "framey_story" ADD COLUMN "closeFriends" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "framey_close_friend" ADD CONSTRAINT "framey_close_friend_userId_framey_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."framey_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "framey_close_friend" ADD CONSTRAINT "framey_close_friend_friendId_framey_user_id_fk" FOREIGN KEY ("friendId") REFERENCES "public"."framey_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "framey_user_block" ADD CONSTRAINT "framey_user_block_blockerId_framey_user_id_fk" FOREIGN KEY ("blockerId") REFERENCES "public"."framey_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "framey_user_block" ADD CONSTRAINT "framey_user_block_blockedId_framey_user_id_fk" FOREIGN KEY ("blockedId") REFERENCES "public"."framey_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "close_friend_friend_idx" ON "framey_close_friend" USING btree ("friendId");--> statement-breakpoint
CREATE INDEX "user_block_blocked_idx" ON "framey_user_block" USING btree ("blockedId");