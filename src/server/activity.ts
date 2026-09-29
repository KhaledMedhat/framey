import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  type AnyColumn,
} from "drizzle-orm";

import { isVideoType } from "@/lib/files";
import { db } from "@/server/db";
import {
  accountEvents,
  highlights,
  messages,
  postComments,
  postLikes,
  postMedia,
  postReposts,
  posts,
  stories,
  users,
  type AccountEventKind,
} from "@/server/db/schema";
import { findPostsInOrder, firstIsVideo, visibleTo } from "@/server/feed";
import { getHighlights } from "@/server/stories";

// ponytail: the newest (or oldest) 120 per tab; page them if someone has more.
const LIMIT = 120;

export type ActivitySort = "newest" | "oldest";
/** Newest or oldest first, optionally between two days (`to` inclusive). */
export type ActivityFilter = { sort: ActivitySort; from?: string; to?: string };

/** `?sort=&from=&to=` as the activity pages read them; anything odd is ignored. */
export function readFilter(params: Record<string, string | string[] | undefined>) {
  const day = (v: unknown) =>
    typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;
  return {
    sort: params.sort === "oldest" ? "oldest" : "newest",
    from: day(params.from),
    to: day(params.to),
  } satisfies ActivityFilter;
}

const between = (column: AnyColumn, { from, to }: ActivityFilter) =>
  and(
    from ? gte(column, new Date(`${from}T00:00:00`)) : undefined,
    to ? lt(column, new Date(new Date(`${to}T00:00:00`).getTime() + 86_400_000)) : undefined,
  );
const order = (column: AnyColumn, { sort }: ActivityFilter) =>
  sort === "oldest" ? asc(column) : desc(column);

/**
 * One tile or row on an activity tab. `id` is what its action works on (the
 * post, comment, message or highlight); `postId` and `conversationId` ride
 * along for the actions that need them.
 */
export type ActivityItem = {
  id: string;
  href: string;
  thumb: string | null;
  video: boolean;
  multiple: boolean;
  text?: string;
  meta?: string;
  postId?: string;
  conversationId?: string;
  createdAt: string;
};

/** A post's first frame: a video's poster or the photo itself. */
const thumbOf = (media: { url: string; type: string | null; cover: { url: string } | null } | undefined) =>
  media ? (isVideoType(media.type) ? (media.cover?.url ?? null) : media.url) : null;

async function postTiles(viewerId: string, ids: string[]): Promise<ActivityItem[]> {
  const found = await findPostsInOrder(viewerId, ids);
  return found.map((post) => {
    const video = isVideoType(post.media[0]?.type);
    return {
      id: post.id,
      postId: post.id,
      href: video ? `/reels/${post.id}` : `/p/${post.id}`,
      thumb: thumbOf(post.media[0]),
      video,
      multiple: post.media.length > 1,
      createdAt: post.createdAt,
    };
  });
}

export async function getActivityLikes(viewerId: string, filter: ActivityFilter) {
  const rows = await db
    .select({ id: postLikes.postId })
    .from(postLikes)
    .innerJoin(posts, eq(posts.id, postLikes.postId))
    .where(and(eq(postLikes.userId, viewerId), visibleTo(viewerId), between(postLikes.createdAt, filter)))
    .orderBy(order(postLikes.createdAt, filter))
    .limit(LIMIT);
  return postTiles(viewerId, rows.map((r) => r.id));
}

export async function getActivityReposts(viewerId: string, filter: ActivityFilter) {
  const rows = await db
    .select({ id: postReposts.postId })
    .from(postReposts)
    .innerJoin(posts, eq(posts.id, postReposts.postId))
    .where(and(eq(postReposts.userId, viewerId), visibleTo(viewerId), between(postReposts.createdAt, filter)))
    .orderBy(order(postReposts.createdAt, filter))
    .limit(LIMIT);
  return postTiles(viewerId, rows.map((r) => r.id));
}

/** Your own posts or reels, as the "Photos and videos" tabs list them. */
export async function getActivityPosts(
  viewerId: string,
  tab: "posts" | "reels",
  filter: ActivityFilter,
) {
  const rows = await db
    .select({ id: posts.id })
    .from(posts)
    .where(
      and(
        eq(posts.authorId, viewerId),
        isNull(posts.archivedAt),
        tab === "reels" ? firstIsVideo() : undefined,
        between(posts.createdAt, filter),
      ),
    )
    .orderBy(order(posts.createdAt, filter))
    .limit(LIMIT);
  return postTiles(viewerId, rows.map((r) => r.id));
}

/** Your comments and replies, each with the post it's on. */
export async function getActivityComments(viewerId: string, filter: ActivityFilter) {
  const rows = await db
    .select({
      id: postComments.id,
      content: postComments.content,
      createdAt: postComments.createdAt,
      postId: postComments.postId,
      author: users.username,
    })
    .from(postComments)
    .innerJoin(posts, eq(posts.id, postComments.postId))
    .innerJoin(users, eq(users.id, posts.authorId))
    .where(and(eq(postComments.authorId, viewerId), visibleTo(viewerId), between(postComments.createdAt, filter)))
    .orderBy(order(postComments.createdAt, filter))
    .limit(LIMIT);
  const media = rows.length
    ? await db
        .select({ postId: postMedia.postId, url: postMedia.url, type: postMedia.type, cover: postMedia.cover })
        .from(postMedia)
        .where(
          and(
            eq(postMedia.order, 0),
            inArray(
              postMedia.postId,
              rows.map((r) => r.postId),
            ),
          ),
        )
    : [];
  return rows.map((row): ActivityItem => {
    const first = media.find((m) => m.postId === row.postId);
    return {
      id: row.id,
      postId: row.postId,
      href: `/p/${row.postId}`,
      thumb: thumbOf(first),
      video: isVideoType(first?.type),
      multiple: false,
      text: row.content || "GIF",
      meta: row.author,
      createdAt: row.createdAt.toISOString(),
    };
  });
}

/** What you wrote back to people's stories (the messages it sent). */
export async function getActivityStoryReplies(viewerId: string, filter: ActivityFilter) {
  const rows = await db
    .select({
      id: messages.id,
      text: messages.text,
      createdAt: messages.createdAt,
      conversationId: messages.conversationId,
      url: stories.url,
      type: stories.type,
      cover: stories.cover,
      author: users.username,
    })
    .from(messages)
    .innerJoin(stories, eq(stories.id, messages.storyId))
    .innerJoin(users, eq(users.id, stories.authorId))
    .where(and(eq(messages.senderId, viewerId), isNotNull(messages.storyId), between(messages.createdAt, filter)))
    .orderBy(order(messages.createdAt, filter))
    .limit(LIMIT);
  return rows.map(
    (row): ActivityItem => ({
      id: row.id,
      conversationId: row.conversationId,
      href: `/direct/${row.conversationId}`,
      thumb: thumbOf({ url: row.url, type: row.type, cover: row.cover }),
      video: isVideoType(row.type),
      multiple: false,
      text: row.text ?? "",
      meta: row.author,
      createdAt: row.createdAt.toISOString(),
    }),
  );
}

/** Your highlights, each opening your profile where they live. */
export async function getActivityHighlights(
  viewerId: string,
  username: string,
  filter: ActivityFilter,
) {
  const [list, dates] = await Promise.all([
    getHighlights(viewerId, viewerId),
    db
      .select({ id: highlights.id, createdAt: highlights.createdAt })
      .from(highlights)
      .where(and(eq(highlights.userId, viewerId), between(highlights.createdAt, filter)))
      .orderBy(order(highlights.createdAt, filter)),
  ]);
  return dates.flatMap(({ id, createdAt }): ActivityItem[] => {
    const highlight = list.find((h) => h.id === id);
    const cover = highlight?.stories[0];
    if (!highlight || !cover) return [];
    return [
      {
        id,
        href: `/${username}`,
        thumb: isVideoType(cover.type) ? (cover.cover?.url ?? null) : cover.url,
        video: false,
        multiple: false,
        text: highlight.title,
        createdAt: createdAt.toISOString(),
      },
    ];
  });
}

export type AccountEvent = {
  id: string;
  kind: AccountEventKind;
  value: string | null;
  createdAt: string;
};

/**
 * Profile changes, plus the day the account was made: always the oldest
 * entry (last when newest-first), shown when the date range includes it.
 */
export async function getAccountHistory(userId: string, filter: ActivityFilter) {
  const [rows, [created]] = await Promise.all([
    db
      .select({
        id: accountEvents.id,
        kind: accountEvents.kind,
        value: accountEvents.value,
        createdAt: accountEvents.createdAt,
      })
      .from(accountEvents)
      .where(and(eq(accountEvents.userId, userId), between(accountEvents.createdAt, filter)))
      .orderBy(order(accountEvents.createdAt, filter))
      .limit(200),
    db
      .select({ createdAt: users.createdAt })
      .from(users)
      .where(and(eq(users.id, userId), between(users.createdAt, filter))),
  ]);
  const events = rows.map(
    (r): AccountEvent => ({ ...r, createdAt: r.createdAt.toISOString() }),
  );
  if (!created) return events;
  const joined: AccountEvent = {
    id: "created",
    kind: "created",
    value: null,
    createdAt: created.createdAt.toISOString(),
  };
  return filter.sort === "oldest" ? [joined, ...events] : [...events, joined];
}

/** Notes each change (a field whose value differs from before) in the account history. */
export async function recordAccountChanges(
  userId: string,
  changes: { kind: AccountEventKind; before: string | null; after: string | null }[],
) {
  const changed = changes.filter((c) => c.before !== c.after);
  if (!changed.length) return;
  await db
    .insert(accountEvents)
    .values(changed.map((c) => ({ userId, kind: c.kind, value: c.after })));
}
