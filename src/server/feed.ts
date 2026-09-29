import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
  ne,
  notInArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import type { FeedCursor, FeedPage, FeedPost } from "@/interfaces/post.interface";
import { AccountVisibility } from "@/interfaces/general.interface";
import { isBlockedEitherWay, notBlocked } from "@/server/blocks";
import { db } from "@/server/db";
import {
  postComments,
  postLikes,
  postMedia,
  postReposts,
  posts,
  savedPosts,
  userFollows,
  users,
} from "@/server/db/schema";

export const FEED_PAGE_SIZE = 8;

export const followedIds = (viewerId: string) =>
  db
    .select({ id: userFollows.followingId })
    .from(userFollows)
    .where(eq(userFollows.followerId, viewerId));

const publicIds = () =>
  db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.visibility, AccountVisibility.PUBLIC));

/**
 * Posts the viewer may see: their own, and unarchived ones from public
 * accounts or people they follow, unless a block stands between them.
 */
export const visibleTo = (viewerId: string) =>
  or(
    eq(posts.authorId, viewerId),
    and(
      isNull(posts.archivedAt),
      or(
        inArray(posts.authorId, publicIds()),
        inArray(posts.authorId, followedIds(viewerId)),
      ),
      notBlocked(posts.authorId, viewerId),
    ),
  );

/**
 * Posts matching `where` as the feed renders them (author, ordered media,
 * counts, the viewer's like), newest first. Fetches `limit + 1` so callers
 * can tell whether another page exists.
 */
export async function findPosts(
  viewerId: string,
  where: SQL | undefined,
  limit: number,
) {
  const rows = await db.query.posts.findMany({
    where,
    orderBy: [desc(posts.createdAt), desc(posts.id)],
    limit: limit + 1,
    columns: {
      id: true,
      caption: true,
      location: true,
      locationId: true,
      createdAt: true,
      hideComments: true,
      hidePostInfo: true,
      tags: true,
      archivedAt: true,
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
      likeCount:
        sql<number>`(select count(*) from ${postLikes} as l where l."postId" = ${table.id})`.as(
          "like_count",
        ),
      commentCount:
        sql<number>`(select count(*) from ${postComments} as c where c."postId" = ${table.id})`.as(
          "comment_count",
        ),
      likedByMe:
        sql<boolean>`exists(select 1 from ${postLikes} as l where l."postId" = ${table.id} and l."userId" = ${viewerId})`.as(
          "liked_by_me",
        ),
      savedByMe:
        sql<boolean>`exists(select 1 from ${savedPosts} as s where s."postId" = ${table.id} and s."userId" = ${viewerId})`.as(
          "saved_by_me",
        ),
      followingAuthor:
        sql<boolean>`exists(select 1 from ${userFollows} as f where f."followerId" = ${viewerId} and f."followingId" = ${table.authorId})`.as(
          "following_author",
        ),
      repostCount:
        sql<number>`(select count(*) from ${postReposts} as r where r."postId" = ${table.id})`.as(
          "repost_count",
        ),
      repostedByMe:
        sql<boolean>`exists(select 1 from ${postReposts} as r where r."postId" = ${table.id} and r."userId" = ${viewerId})`.as(
          "reposted_by_me",
        ),
    }),
  });

  // Postgres returns count(*) as a bigint string and `extras` skip mapWith,
  // so coerce here; otherwise `count + 1` concatenates ("1" + 1 = "11").
  const mapped: FeedPost[] = rows.map(({ archivedAt, ...post }) => ({
    ...post,
    archived: archivedAt !== null,
    createdAt: post.createdAt.toISOString(),
    likeCount: Number(post.likeCount),
    commentCount: Number(post.commentCount),
    likedByMe: post.likedByMe === true || String(post.likedByMe) === "true",
    savedByMe: post.savedByMe === true || String(post.savedByMe) === "true",
    followingAuthor:
      post.followingAuthor === true || String(post.followingAuthor) === "true",
    repostCount: Number(post.repostCount),
    repostedByMe:
      post.repostedByMe === true || String(post.repostedByMe) === "true",
  }));
  return { posts: mapped.slice(0, limit), hasMore: rows.length > limit };
}

/** Posts that open on a video: a profile's Reels tab, the reels viewer. */
export const firstIsVideo = () =>
  inArray(
    posts.id,
    db
      .select({ id: postMedia.postId })
      .from(postMedia)
      .where(and(eq(postMedia.order, 0), sql`${postMedia.type} like 'video/%'`)),
  );

export const REELS_PAGE_SIZE = 5;

/** Random reels from anyone the viewer may see, skipping ones already shown. */
export async function getRandomReels(
  viewerId: string,
  exclude: string[],
  limit = REELS_PAGE_SIZE,
) {
  // ponytail: order by random() scans every reel; sample with TABLESAMPLE
  // or a random key once there are tens of thousands.
  const picked = await db
    .select({ id: posts.id })
    .from(posts)
    .where(
      and(
        isNull(posts.archivedAt),
        visibleTo(viewerId),
        firstIsVideo(),
        exclude.length ? notInArray(posts.id, exclude) : undefined,
      ),
    )
    .orderBy(sql`random()`)
    .limit(limit);
  if (!picked.length) return [];
  const { posts: found } = await findPosts(
    viewerId,
    inArray(posts.id, picked.map((p) => p.id)),
    limit,
  );
  return found.sort(() => Math.random() - 0.5);
}

/** `ids` as findPosts renders them, in the order given. */
export async function findPostsInOrder(viewerId: string, ids: string[]) {
  if (!ids.length) return [];
  const { posts: found } = await findPosts(
    viewerId,
    inArray(posts.id, ids),
    ids.length,
  );
  const byId = new Map(found.map((p) => [p.id, p]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}

/**
 * The viewer's own posts, everyone they follow, and posts the viewer or
 * those people reposted, newest first by when each reached the feed: posted,
 * or last reposted ("You reposted", "{name} reposted").
 */
export async function getFeedPage(
  viewerId: string,
  cursor?: FeedCursor,
  limit = FEED_PAGE_SIZE,
): Promise<FeedPage> {
  const followed = followedIds(viewerId);
  const repostedAt = sql<Date | null>`(select max(r."createdAt") from ${postReposts} as r where r."postId" = ${posts.id} and (r."userId" = ${viewerId} or r."userId" in (${followed})))`;
  const feedAt = sql<Date>`greatest(case when ${posts.authorId} = ${viewerId} or ${posts.authorId} in (${followed}) then ${posts.createdAt} end, ${repostedAt})`;
  const rows = await db
    .select({ id: posts.id, feedAt: sql<Date>`${feedAt}`.mapWith(posts.createdAt) })
    .from(posts)
    .where(
      and(
        visibleTo(viewerId),
        isNull(posts.archivedAt),
        sql`${feedAt} is not null`,
        // Keyset pagination on (feedAt, id): stable while new posts arrive.
        cursor
          ? sql`(${feedAt}, ${posts.id}) < (${new Date(cursor.createdAt)}, ${cursor.id})`
          : undefined,
      ),
    )
    .orderBy(desc(feedAt), desc(posts.id))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  const ids = page.map((r) => r.id);

  const [found, reposters] = await Promise.all([
    findPostsInOrder(viewerId, ids),
    ids.length
      ? db
          .selectDistinctOn([postReposts.postId], {
            postId: postReposts.postId,
            username: users.username,
            profilePicture: users.profilePicture,
          })
          .from(postReposts)
          .innerJoin(users, eq(users.id, postReposts.userId))
          .where(
            and(
              inArray(postReposts.postId, ids),
              inArray(postReposts.userId, followedIds(viewerId)),
            ),
          )
          .orderBy(postReposts.postId, desc(postReposts.createdAt))
      : [],
  ]);

  const last = page.at(-1);
  return {
    posts: found.map((post) => ({
      ...post,
      repostedBy: reposters.find((r) => r.postId === post.id) ?? null,
    })),
    nextCursor:
      rows.length > limit && last
        ? { createdAt: last.feedAt.toISOString(), id: last.id }
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
      notBlocked(users.id, viewerId),
    ),
    orderBy: asc(users.username),
    limit,
    columns: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      profilePicture: true,
      visibility: true,
    },
  });
}

/**
 * Public authors are visible to everyone; private ones to themselves and
 * followers; archived posts to their author only. Resolves to the post's
 * author and settings when visible, null otherwise.
 */
export async function canViewPost(viewerId: string, postId: string) {
  const [row] = await db
    .select({
      authorId: posts.authorId,
      visibility: users.visibility,
      archivedAt: posts.archivedAt,
      hideComments: posts.hideComments,
    })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.authorId))
    .where(eq(posts.id, postId))
    .limit(1);
  if (!row) return null;
  if (row.authorId === viewerId) return row;
  if (row.archivedAt) return null;
  if (await isBlockedEitherWay(viewerId, row.authorId)) return null;
  if (row.visibility === AccountVisibility.PUBLIC) return row;
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
  return follow ? row : null;
}

export const LOCATION_POST_LIMIT = 60;

/**
 * Posts tagged with one Photon place that the viewer may see (public
 * authors, themselves, people they follow), newest first. The newest post's
 * label and coordinates name the place.
 */
export async function getLocationPage(viewerId: string, locationId: string) {
  const rows = await db
    .select({
      id: posts.id,
      location: posts.location,
      lat: posts.locationLat,
      lng: posts.locationLng,
    })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.authorId))
    .where(
      and(
        eq(posts.locationId, locationId),
        isNull(posts.archivedAt),
        notBlocked(posts.authorId, viewerId),
        or(
          eq(users.visibility, AccountVisibility.PUBLIC),
          eq(posts.authorId, viewerId),
          inArray(posts.authorId, followedIds(viewerId)),
        ),
      ),
    )
    .orderBy(desc(posts.createdAt), desc(posts.id))
    // ponytail: one page, no infinite scroll; page with a (createdAt, id)
    // cursor like getFeedPage once a place outgrows it.
    .limit(LOCATION_POST_LIMIT);

  const place = rows[0];
  if (!place) return null;

  const media = await db.query.postMedia.findMany({
    where: and(
      inArray(
        postMedia.postId,
        rows.map((r) => r.id),
      ),
      eq(postMedia.order, 0),
    ),
    columns: { postId: true, url: true, type: true, alt: true, cover: true },
  });
  const firstMedia = new Map(media.map((m) => [m.postId, m]));
  const counts = await db
    .select({ postId: postMedia.postId, count: sql<number>`count(*)` })
    .from(postMedia)
    .where(
      inArray(
        postMedia.postId,
        rows.map((r) => r.id),
      ),
    )
    .groupBy(postMedia.postId);
  const mediaCount = new Map(counts.map((c) => [c.postId, Number(c.count)]));

  return {
    name: place.location ?? "",
    lat: place.lat,
    lng: place.lng,
    posts: rows.flatMap((row) => {
      const first = firstMedia.get(row.id);
      return first
        ? [
            {
              id: row.id,
              media: first,
              multiple: (mediaCount.get(row.id) ?? 1) > 1,
            },
          ]
        : [];
    }),
  };
}
