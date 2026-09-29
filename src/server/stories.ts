import { and, asc, desc, eq, gt, inArray, or, sql } from "drizzle-orm";

import { AccountVisibility } from "@/interfaces/general.interface";
import { isBlockedEitherWay } from "@/server/blocks";

import type { Story, StoryReel } from "@/interfaces/story.interface";
import { db } from "@/server/db";
import {
  closeFriends,
  highlights,
  stories,
  storyLikes,
  storyViews,
  userFollows,
  users,
} from "@/server/db/schema";
import { followedIds } from "@/server/feed";
import { STORY_TTL_MS } from "@/lib/utils";

export { STORY_TTL_MS };
const liveSince = () => new Date(Date.now() - STORY_TTL_MS);

/** Everyone who put the viewer on their close friends list. */
const closeFriendOf = (viewerId: string) =>
  db
    .select({ id: closeFriends.userId })
    .from(closeFriends)
    .where(eq(closeFriends.friendId, viewerId));

/** Stories for everyone, plus close-friends ones the viewer is on the list for. */
export const storyAudience = (viewerId: string) =>
  or(
    eq(stories.closeFriends, false),
    eq(stories.authorId, viewerId),
    inArray(stories.authorId, closeFriendOf(viewerId)),
  );

export const isCloseFriend = (userId: string, friendId: string) =>
  db
    .select({ id: closeFriends.userId })
    .from(closeFriends)
    .where(
      and(eq(closeFriends.userId, userId), eq(closeFriends.friendId, friendId)),
    )
    .limit(1)
    .then((rows) => rows.length > 0);

const storyQuery = (viewerId: string) =>
  ({
    columns: {
      id: true,
      url: true,
      type: true,
      width: true,
      height: true,
      cover: true,
      muted: true,
      duration: true,
      closeFriends: true,
      overlays: true,
      createdAt: true,
    },
    // Same local-alias trick as findPosts: `extras` columns get the outer alias.
    extras: (table: {
      id: typeof stories.id;
      authorId: typeof stories.authorId;
      repostOfUserId: typeof stories.repostOfUserId;
    }) => ({
      repostOf: sql<string | null>`(select u.username from ${users} as u where u.id = ${table.repostOfUserId})`.as(
        "repost_of",
      ),
      seen: sql<boolean>`exists(select 1 from ${storyViews} as v where v."storyId" = ${table.id} and v."viewerId" = ${viewerId})`.as(
        "seen",
      ),
      likedByMe: sql<boolean>`exists(select 1 from ${storyLikes} as l where l."storyId" = ${table.id} and l."userId" = ${viewerId})`.as(
        "liked_by_me",
      ),
      // Counts are the author's business; everyone else gets 0.
      likeCount: sql<number>`(select count(*) from ${storyLikes} as l where l."storyId" = ${table.id} and ${table.authorId} = ${viewerId})`.as(
        "like_count",
      ),
      viewCount: sql<number>`(select count(*) from ${storyViews} as v where v."storyId" = ${table.id} and v."viewerId" <> ${viewerId} and ${table.authorId} = ${viewerId})`.as(
        "view_count",
      ),
    }),
  }) as const;

const toStory = ({
  createdAt,
  seen,
  likedByMe,
  likeCount,
  viewCount,
  repostOf,
  ...story
}: {
  createdAt: Date;
  seen: unknown;
  likedByMe: unknown;
  likeCount: unknown;
  viewCount: unknown;
  repostOf: unknown;
} & Omit<
  Story,
  "createdAt" | "seen" | "likedByMe" | "likeCount" | "viewCount" | "repostOf"
>): Story => ({
  ...story,
  createdAt: createdAt.toISOString(),
  seen: seen === true || String(seen) === "true",
  likedByMe: likedByMe === true || String(likedByMe) === "true",
  likeCount: Number(likeCount),
  viewCount: Number(viewCount),
  repostOf: typeof repostOf === "string" ? repostOf : null,
});

/**
 * The story's author when the viewer may see it: in its audience, no block
 * between them, and a public author or one they follow. Null otherwise.
 */
export async function canSeeStory(viewerId: string, storyId: string) {
  const [row] = await db
    .select({ authorId: stories.authorId, visibility: users.visibility })
    .from(stories)
    .innerJoin(users, eq(users.id, stories.authorId))
    .where(and(eq(stories.id, storyId), storyAudience(viewerId)))
    .limit(1);
  if (!row) return null;
  if (row.authorId === viewerId) return row;
  if (await isBlockedEitherWay(viewerId, row.authorId)) return null;
  if (row.visibility === AccountVisibility.PUBLIC) return row;
  const follows = await db.$count(
    userFollows,
    and(eq(userFollows.followerId, viewerId), eq(userFollows.followingId, row.authorId)),
  );
  return follows ? row : null;
}

/** Who saw the author's story, newest first, and whether each loved it. */
export async function getStoryViewers(authorId: string, storyId: string) {
  const [story] = await db
    .select({ id: stories.id })
    .from(stories)
    .where(and(eq(stories.id, storyId), eq(stories.authorId, authorId)))
    .limit(1);
  if (!story) return null;
  return db
    .select({
      id: users.id,
      username: users.username,
      firstName: users.firstName,
      lastName: users.lastName,
      profilePicture: users.profilePicture,
      liked: sql<boolean>`exists(select 1 from ${storyLikes} as l where l."storyId" = ${storyId} and l."userId" = ${users.id})`,
    })
    .from(storyViews)
    .innerJoin(users, eq(users.id, storyViews.viewerId))
    .where(and(eq(storyViews.storyId, storyId), sql`${storyViews.viewerId} <> ${authorId}`))
    // ponytail: first 200 viewers; page it for big audiences.
    .limit(200)
    .then((rows) =>
      rows.map((r) => ({ ...r, liked: r.liked === true || String(r.liked) === "true" })),
    );
}

const author = {
  columns: { id: true, username: true, profilePicture: true },
} as const;

/**
 * Live stories from the viewer and everyone they follow, one reel per
 * person: the viewer first, then unseen reels, then the ones already watched.
 */
export async function getStoryTray(viewerId: string): Promise<StoryReel[]> {
  const rows = await db.query.stories.findMany({
    ...storyQuery(viewerId),
    where: and(
      gt(stories.createdAt, liveSince()),
      storyAudience(viewerId),
      or(
        eq(stories.authorId, viewerId),
        inArray(stories.authorId, followedIds(viewerId)),
      ),
    ),
    orderBy: asc(stories.createdAt),
    with: { author },
  });

  const reels = new Map<string, StoryReel>();
  for (const { author, ...row } of rows) {
    const reel = reels.get(author.id) ?? { user: author, stories: [], seen: true };
    const story = toStory(row);
    reel.stories.push(story);
    reel.seen &&= story.seen;
    reels.set(author.id, reel);
  }
  return [...reels.values()].sort(
    (a, b) =>
      Number(b.user.id === viewerId) - Number(a.user.id === viewerId) ||
      Number(a.seen) - Number(b.seen),
  );
}

/** One person's live stories, oldest first. Callers check they may see them. */
export async function getUserStories(viewerId: string, userId: string) {
  const rows = await db.query.stories.findMany({
    ...storyQuery(viewerId),
    where: and(
      eq(stories.authorId, userId),
      gt(stories.createdAt, liveSince()),
      storyAudience(viewerId),
    ),
    orderBy: asc(stories.createdAt),
  });
  return rows.map(toStory);
}

export async function getHighlights(viewerId: string, userId: string) {
  const [rows, close] = await Promise.all([
    db.query.highlights.findMany({
      where: eq(highlights.userId, userId),
      orderBy: asc(highlights.createdAt),
      columns: { id: true, title: true },
      with: { stories: { with: { story: storyQuery(viewerId) } } },
    }),
    viewerId === userId || isCloseFriend(userId, viewerId),
  ]);
  return rows
    .map(({ stories: links, ...highlight }) => ({
      ...highlight,
      stories: links
        .map((l) => toStory(l.story))
        .filter((s) => close || !s.closeFriends)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    }))
    .filter((h) => h.stories.length > 0);
}

export type Highlight = Awaited<ReturnType<typeof getHighlights>>[number];

/** Every story the user ever shared, newest first: their story archive. */
export async function getArchivedStories(userId: string) {
  const rows = await db.query.stories.findMany({
    ...storyQuery(userId),
    where: eq(stories.authorId, userId),
    orderBy: desc(stories.createdAt),
  });
  return rows.map(toStory);
}
