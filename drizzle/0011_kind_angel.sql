ALTER TABLE "framey_user" ADD COLUMN "createdAt" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
-- Accounts from before this column: their earliest trace in the app, else now.
UPDATE "framey_user" AS u SET "createdAt" = COALESCE(LEAST(
	(SELECT min(p."createdAt") FROM "framey_post" p WHERE p."authorId" = u."id"),
	(SELECT min(s."createdAt") FROM "framey_story" s WHERE s."authorId" = u."id"),
	(SELECT min(c."createdAt") FROM "framey_post_comment" c WHERE c."authorId" = u."id"),
	(SELECT min(l."createdAt") FROM "framey_post_like" l WHERE l."userId" = u."id"),
	(SELECT min(f."createdAt") FROM "framey_user_follow" f WHERE f."followerId" = u."id" OR f."followingId" = u."id"),
	(SELECT min(e."createdAt") FROM "framey_account_event" e WHERE e."userId" = u."id")
), u."createdAt");
