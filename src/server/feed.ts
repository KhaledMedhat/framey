import { and, asc, desc, eq, inArray, lt, ne, notInArray, or, sql } from "drizzle-orm";

import type { FeedCursor, FeedPage } from "@/interfaces/post.interface";
import { AccountVisibility } from "@/interfaces/general.interface";
import { db } from "@/server/db";
import {
  postComments,
  postLikes,
  postMedia,
  posts,
  userFollows,
  users,
} from "@/server/db/schema";

export const FEED_PAGE_SIZE = 8;

const followedIds = (viewerId: string) =>
  db
    .select({ id: userFollows.followingId })
    .from(userFollows)
    .where(eq(userFollows.followerId, viewerId));

/** The viewer's own posts plus everyone they follow, newest first. */
export async function getFeedPage(
  viewerId: string,
  cursor?: FeedCursor,
  limit = FEED_PAGE_SIZE,
): Promise<FeedPage> {
  const rows = await db.query.posts.findMany({
    where: and(
      or(eq(posts.authorId, viewerId), inArray(posts.authorId, followedIds(viewerId))),
      // Keyset pagination on (createdAt, id): stable while new posts arrive.
      cursor
        ? or(
            lt(posts.createdAt, new Date(cursor.createdAt)),
            and(
              eq(posts.createdAt, new Date(cursor.createdAt)),
              lt(posts.id, cursor.id),
            ),
          )
        : undefined,
    ),
    orderBy: [desc(posts.createdAt), desc(posts.id)],
    limit: limit + 1,
    columns: {
      id: true,
      caption: true,
      location: true,
      createdAt: true,
      hideComments: true,
      hidePostInfo: true,
    },
    with: {
      author: {
        columns: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          profilePicture: true,
          visibility: true,
        },
      },
      media: {
        orderBy: asc(postMedia.order),
        columns: {
          id: true,
          url: true,
          type: true,
          width: true,
          height: true,
          alt: true,
          cover: true,
          muted: true,
        },
      },
    },
    // The relational builder rewrites every column in `extras` to the outer
    // query's alias, so the subqueries name their own columns through a
    // local alias instead of interpolating them.
    extras: (table) => ({
      likeCount: sql<number>`(select count(*) from ${postLikes} as l where l."postId" = ${table.id})`.as("like_count"),
      commentCount: sql<number>`(select count(*) from ${postComments} as c where c."postId" = ${table.id})`.as("comment_count"),
      likedByMe: sql<boolean>`exists(select 1 from ${postLikes} as l where l."postId" = ${table.id} and l."userId" = ${viewerId})`.as("liked_by_me"),
    }),
  });

  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    // Postgres returns count(*) as a bigint string and `extras` skip mapWith,
    // so coerce here; otherwise `count + 1` concatenates ("1" + 1 = "11").
    posts: page.map((post) => ({
      ...post,
      createdAt: post.createdAt.toISOString(),
      likeCount: Number(post.likeCount),
      commentCount: Number(post.commentCount),
      likedByMe: post.likedByMe === true || String(post.likedByMe) === "true",
    })),
    nextCursor:
      rows.length > limit && last
        ? { createdAt: last.createdAt.toISOString(), id: last.id }
        : null,
  };
}

/** Accounts the viewer doesn't follow yet, for the side rail and empty state. */
export function getSuggestedAccounts(viewerId: string, limit = 5) {
  return db.query.users.findMany({
    where: and(
      ne(users.id, viewerId),
      eq(users.profileComplete, true),
      notInArray(users.id, followedIds(viewerId)),
    ),
    orderBy: asc(users.username),
    limit,
    columns: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      profilePicture: true,
    },
  });
}

/** Public authors are visible to everyone; private ones to themselves and followers. */
export async function canViewPost(viewerId: string, postId: string) {
  const [row] = await db
    .select({ authorId: posts.authorId, visibility: users.visibility })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.authorId))
    .where(eq(posts.id, postId))
    .limit(1);
  if (!row) return false;
  if (row.visibility === AccountVisibility.PUBLIC || row.authorId === viewerId) {
    return true;
  }
  const [follow] = await db
    .select({ id: userFollows.followerId })
    .from(userFollows)
    .where(
      and(
        eq(userFollows.followerId, viewerId),
        eq(userFollows.followingId, row.authorId),
      ),
    )
    .limit(1);
  return Boolean(follow);
}
