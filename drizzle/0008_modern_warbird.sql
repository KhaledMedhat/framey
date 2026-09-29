CREATE TABLE "framey_conversation_member" (
	"conversationId" uuid NOT NULL,
	"userId" varchar(255) NOT NULL,
	"accepted" boolean DEFAULT true NOT NULL,
	"lastReadAt" timestamp with time zone NOT NULL,
	"clearedAt" timestamp with time zone,
	"joinedAt" timestamp with time zone NOT NULL,
	CONSTRAINT "framey_conversation_member_conversationId_userId_pk" PRIMARY KEY("conversationId","userId")
);
--> statement-breakpoint
CREATE TABLE "framey_conversation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"isGroup" boolean DEFAULT false NOT NULL,
	"name" varchar(100),
	"createdById" varchar(255) NOT NULL,
	"lastMessageAt" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "framey_message_like" (
	"messageId" uuid NOT NULL,
	"userId" varchar(255) NOT NULL,
	CONSTRAINT "framey_message_like_messageId_userId_pk" PRIMARY KEY("messageId","userId")
);
--> statement-breakpoint
CREATE TABLE "framey_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversationId" uuid NOT NULL,
	"senderId" varchar(255) NOT NULL,
	"text" text,
	"postId" uuid,
	"media" jsonb,
	"createdAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "framey_conversation_member" ADD CONSTRAINT "framey_conversation_member_conversationId_framey_conversation_id_fk" FOREIGN KEY ("conversationId") REFERENCES "public"."framey_conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "framey_conversation_member" ADD CONSTRAINT "framey_conversation_member_userId_framey_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."framey_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "framey_conversation" ADD CONSTRAINT "framey_conversation_createdById_framey_user_id_fk" FOREIGN KEY ("createdById") REFERENCES "public"."framey_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "framey_message_like" ADD CONSTRAINT "framey_message_like_messageId_framey_message_id_fk" FOREIGN KEY ("messageId") REFERENCES "public"."framey_message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "framey_message_like" ADD CONSTRAINT "framey_message_like_userId_framey_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."framey_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "framey_message" ADD CONSTRAINT "framey_message_conversationId_framey_conversation_id_fk" FOREIGN KEY ("conversationId") REFERENCES "public"."framey_conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "framey_message" ADD CONSTRAINT "framey_message_senderId_framey_user_id_fk" FOREIGN KEY ("senderId") REFERENCES "public"."framey_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "framey_message" ADD CONSTRAINT "framey_message_postId_framey_post_id_fk" FOREIGN KEY ("postId") REFERENCES "public"."framey_post"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conversation_member_user_idx" ON "framey_conversation_member" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "message_conversation_idx" ON "framey_message" USING btree ("conversationId","createdAt");