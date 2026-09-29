import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
} from "drizzle-orm";
import { cache } from "react";

import { AccountVisibility } from "@/interfaces/general.interface";
import { blockBetween } from "@/server/blocks";
import { db } from "@/server/db";
import {
  closeFriends,
  followRequests,
  postCollaborators,
  postReposts,
  posts,
  savedCollectionPosts,
  savedCollections,
  savedPosts,
  stories,
  userFollows,
  users,
} from "@/server/db/schema";
import {
  findPosts,
  findPostsInOrder,
  firstIsVideo,
  visibleTo,
} from "@/server/feed";
import { STORY_TTL_MS, storyAudience } from "@/server/stories";

export type ProfileTab = "posts" | "reels" | "tagged";

// ponytail: one page per tab, no infinite scroll; page with a (createdAt, id)
// cursor like getFeedPage once a profile outgrows it.
export const PROFILE_POST_LIMIT = 60;

const isFollowing = (followerId: string, followingId: string) =>
  db
    .select({ id: userFollows.followerId })
    .from(userFollows)
    .where(
      and(
        eq(userFollows.followerId, followerId),
        eq(userFollows.followingId, followingId),
      ),
    )
    .limit(1)
    .then((rows) => rows.length > 0);

// Subqueries stay uncorrelated: the relational builder aliases the outer
// `framey_post` as "posts", so a subquery can't name it by table.

/** Posts they wrote or were added to as a collaborator. */
const ownPosts = (userId: string) =>
  or(
    eq(posts.authorId, userId),
    inArray(
      posts.id,
      db
        .select({ id: postCollaborators.postId })
        .from(postCollaborators)
        .where(eq(postCollaborators.userId, userId)),
    ),
  );

/**
 * A profile as the viewer sees it: who, the counts, how the two are
 * connected, and whether the viewer may see the posts. Cached per request so
 * the page and its metadata share one lookup.
 */
export const getProfile = cache(async (viewerId: string, username: string) => {
  const user = await db.query.users.findFirst({
    where: and(eq(users.username, username), eq(users.profileComplete, true)),
    columns: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      bio: true,
      websites: true,
      profilePicture: true,
      visibility: true,
    },
  });
  if (!user) return null;

  const isMe = user.id === viewerId;
  // The block check runs alongside the counts: one round trip, not two.
  const [
    block,
    [postCount],
    [followerCount],
    [followingCount],
    following,
    followsMe,
    [request],
    [story],
  ] = await Promise.all([
      isMe ? { blocked: false, blockedBy: false } : blockBetween(viewerId, user.id),
      db
        .select({ n: count() })
        .from(posts)
        .where(and(ownPosts(user.id), isNull(posts.archivedAt))),
      db
        .select({ n: count() })
        .from(userFollows)
        .where(eq(userFollows.followingId, user.id)),
      db
        .select({ n: count() })
        .from(userFollows)
        .where(eq(userFollows.followerId, user.id)),
      isMe ? false : isFollowing(viewerId, user.id),
      isMe ? false : isFollowing(user.id, viewerId),
      db
        .select({ id: followRequests.requesterId })
        .from(followRequests)
        .where(
          and(
            eq(followRequests.requesterId, viewerId),
            eq(followRequests.targetId, user.id),
          ),
        )
        .limit(1),
      db
        .select({ id: stories.id })
        .from(stories)
        .where(
          and(
            eq(stories.authorId, user.id),
            gt(stories.createdAt, new Date(Date.now() - STORY_TTL_MS)),
            storyAudience(viewerId),
          ),
        )
        .limit(1),
    ]);
  // Whoever blocked the viewer is gone for them, like a deleted account.
  if (block.blockedBy) return null;

  const canView =
    !block.blocked &&
    (isMe || following || user.visibility === AccountVisibility.PUBLIC);
  return {
    ...user,
    isMe,
    /** The viewer blocked them: the page offers Unblock and nothing else. */
    blocked: block.blocked,
    following,
    followsMe,
    /** A follow request from the viewer is waiting on this private account. */
    requested: Boolean(request),
    hasStory: canView && Boolean(story),
    canView,
    counts: {
      posts: postCount?.n ?? 0,
      followers: followerCount?.n ?? 0,
      following: followingCount?.n ?? 0,
    },
  };
});

export type Profile = NonNullable<Awaited<ReturnType<typeof getProfile>>>;

/**
 * One tab of a profile's grid. Posts: written or collaborated on. Reels:
 * those whose first media is a video. Tagged: someone else's post with this
 * user tagged in it, if the viewer may see it. Archived posts are left out.
 */
export function getProfilePosts(
  viewerId: string,
  userId: string,
  tab: ProfileTab,
  limit = PROFILE_POST_LIMIT,
) {
  const where =
    tab === "tagged"
      ? and(
          sql`${posts.tags} @> ${JSON.stringify([{ userId }])}::jsonb`,
          visibleTo(viewerId),
        )
      : tab === "reels"
        ? and(ownPosts(userId), firstIsVideo())
        : ownPosts(userId);
  return findPosts(
    viewerId,
    and(where, isNull(posts.archivedAt)),
    limit,
  );
}

/** What `userId` reposted that the viewer may see, newest repost first. */
export async function getReposts(viewerId: string, userId: string) {
  const rows = await db
    .select({ id: postReposts.postId })
    .from(postReposts)
    .innerJoin(posts, eq(posts.id, postReposts.postId))
    .where(and(eq(postReposts.userId, userId), visibleTo(viewerId)))
    .orderBy(desc(postReposts.createdAt))
    .limit(PROFILE_POST_LIMIT);
  return findPostsInOrder(
    viewerId,
    rows.map((r) => r.id),
  );
}

/**
 * The viewer's saved posts they can still see, and their collections with
 * which of those posts each holds.
 * ponytail: ordered by post date, not save date; join savedPosts.createdAt
 * into findPosts if that ordering matters.
 */
export async function getSaved(viewerId: string) {
  const [grid, collections, links] = await Promise.all([
    findPosts(
      viewerId,
      and(
        inArray(
          posts.id,
          db
            .select({ id: savedPosts.postId })
            .from(savedPosts)
            .where(eq(savedPosts.userId, viewerId)),
        ),
        visibleTo(viewerId),
      ),
      PROFILE_POST_LIMIT,
    ),
    db
      .select({ id: savedCollections.id, name: savedCollections.name })
      .from(savedCollections)
      .where(eq(savedCollections.userId, viewerId))
      .orderBy(asc(savedCollections.createdAt)),
    db
      .select({
        collectionId: savedCollectionPosts.collectionId,
        postId: savedCollectionPosts.postId,
      })
      .from(savedCollectionPosts)
      .innerJoin(
        savedCollections,
        eq(savedCollections.id, savedCollectionPosts.collectionId),
      )
      .where(eq(savedCollections.userId, viewerId)),
  ]);
  return {
    posts: grid.posts,
    collections: collections.map((c) => ({
      ...c,
      postIds: links.filter((l) => l.collectionId === c.id).map((l) => l.postId),
    })),
  };
}

export type Saved = Awaited<ReturnType<typeof getSaved>>;

/** Posts the user archived: hidden from everyone else until restored. */
export const getArchivedPosts = (userId: string) =>
  findPosts(
    userId,
    and(eq(posts.authorId, userId), isNotNull(posts.archivedAt)),
    PROFILE_POST_LIMIT,
  );

/** Who follows them, or whom they follow, newest connection first. */
export function getFollowList(userId: string, list: "followers" | "following") {
  const [match, other] =
    list === "followers"
      ? [userFollows.followingId, userFollows.followerId]
      : [userFollows.followerId, userFollows.followingId];
  return db
    .select({
      id: users.id,
      username: users.username,
      firstName: users.firstName,
      lastName: users.lastName,
      profilePicture: users.profilePicture,
      visibility: users.visibility,
    })
    .from(userFollows)
    .innerJoin(users, eq(users.id, other))
    .where(eq(match, userId))
    .orderBy(sql`${userFollows.createdAt} desc`)
    // ponytail: first 200 only; page it when someone gets popular.
    .limit(200);
}

/** The user's followers, marked when they're on the close friends list. */
export async function getCloseFriendChoices(userId: string) {
  const [followers, close] = await Promise.all([
    getFollowList(userId, "followers"),
    db
      .select({ id: closeFriends.friendId })
      .from(closeFriends)
      .where(eq(closeFriends.userId, userId)),
  ]);
  const ids = new Set(close.map((c) => c.id));
  return followers.map((f) => ({ ...f, close: ids.has(f.id) }));
}

export type CloseFriendChoice = Awaited<
  ReturnType<typeof getCloseFriendChoices>
>[number];
