import {
  and,
  count,
  desc,
  eq,
  exists,
  gt,
  inArray,
  isNull,
  lt,
  ne,
  or,
  sql,
} from "drizzle-orm";

import type { FeedPost, MediaCover } from "@/interfaces/post.interface";
import { auth } from "@/server/auth";
import { isBlockedEitherWay } from "@/server/blocks";
import { db } from "@/server/db";
import {
  conversationMembers as members,
  conversations,
  messageLikes,
  messages,
  posts,
  stories,
  userFollows,
  users,
} from "@/server/db/schema";
import { STORY_TTL_MS } from "@/lib/utils";
import { canViewPost, findPosts, visibleTo } from "@/server/feed";
import { push } from "@/server/notifications";

export const MESSAGE_PAGE_SIZE = 30;
export const GROUP_MAX = 32;

/** Pusher events on the user channel. `chat`: something in it changed, refetch. */
export const CHAT_EVENT = "chat";
export const TYPING_EVENT = "typing";

const preview = {
  id: users.id,
  username: users.username,
  firstName: users.firstName,
  lastName: users.lastName,
  profilePicture: users.profilePicture,
};

export class ChatError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Runs `handler` for the signed-in user; a ChatError becomes its response. */
export async function asViewer(handler: (viewerId: string) => Promise<Response>) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ message: "Sign in first." }, { status: 401 });
  }
  try {
    return await handler(session.user.id);
  } catch (error) {
    if (error instanceof ChatError) {
      return Response.json({ message: error.message }, { status: error.status });
    }
    throw error;
  }
}

const follows = async (followerId: string, followingId: string) =>
  !!(await db.$count(
    userFollows,
    and(
      eq(userFollows.followerId, followerId),
      eq(userFollows.followingId, followingId),
    ),
  ));

/** The viewer's membership and the chat's settings, or null if they aren't in it. */
async function membership(viewerId: string, conversationId: string) {
  const [row] = await db
    .select({
      isGroup: conversations.isGroup,
      name: conversations.name,
      createdById: conversations.createdById,
      accepted: members.accepted,
      clearedAt: members.clearedAt,
    })
    .from(members)
    .innerJoin(conversations, eq(conversations.id, members.conversationId))
    .where(
      and(eq(members.conversationId, conversationId), eq(members.userId, viewerId)),
    )
    .limit(1);
  return row ?? null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function mustBeMember(viewerId: string, conversationId: string) {
  const member = UUID.test(conversationId)
    ? await membership(viewerId, conversationId)
    : null;
  if (!member) throw new ChatError("Chat not found.", 404);
  return member;
}

const otherMemberIds = async (conversationId: string, viewerId: string) =>
  (
    await db
      .select({ id: members.userId })
      .from(members)
      .where(
        and(eq(members.conversationId, conversationId), ne(members.userId, viewerId)),
      )
  ).map((m) => m.id);

/** Tells everyone else in the chat (and the viewer's other tabs) to refetch it. */
async function announce(conversationId: string, viewerId: string, self = true) {
  const others = await otherMemberIds(conversationId, viewerId);
  await push(self ? [...others, viewerId] : others, CHAT_EVENT, { conversationId });
}

/** Messages the viewer can still see: not from before they cleared the chat. */
const sinceCleared = (clearedAt: Date | null) =>
  clearedAt ? gt(messages.createdAt, clearedAt) : undefined;

export type ChatFolder = "inbox" | "requests";

/**
 * The viewer's chats in a folder, latest activity first, each with the other
 * members, its last message and whether that's unread. Chats someone else
 * started stay hidden until the first message arrives.
 */
export async function getChats(viewerId: string, folder: ChatFolder) {
  const rows = await db
    .select({
      id: conversations.id,
      isGroup: conversations.isGroup,
      name: conversations.name,
      createdById: conversations.createdById,
      lastMessageAt: conversations.lastMessageAt,
      lastReadAt: members.lastReadAt,
      clearedAt: members.clearedAt,
    })
    .from(members)
    .innerJoin(conversations, eq(conversations.id, members.conversationId))
    .where(
      and(
        eq(members.userId, viewerId),
        eq(members.accepted, folder === "inbox"),
        or(
          isNull(members.clearedAt),
          gt(conversations.lastMessageAt, members.clearedAt),
        ),
      ),
    )
    .orderBy(desc(conversations.lastMessageAt))
    // ponytail: newest 50 chats; page the list when inboxes get that long.
    .limit(50);
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);

  const [people, lasts] = await Promise.all([
    db
      .select({ conversationId: members.conversationId, ...preview })
      .from(members)
      .innerJoin(users, eq(users.id, members.userId))
      .where(and(inArray(members.conversationId, ids), ne(members.userId, viewerId))),
    db
      .selectDistinctOn([messages.conversationId], {
        conversationId: messages.conversationId,
        senderId: messages.senderId,
        text: messages.text,
        postId: messages.postId,
        media: messages.media,
        storyId: messages.storyId,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(inArray(messages.conversationId, ids))
      .orderBy(messages.conversationId, desc(messages.createdAt)),
  ]);

  return rows.flatMap((row) => {
    const last = lasts.find((m) => m.conversationId === row.id);
    const shown = last && (!row.clearedAt || last.createdAt > row.clearedAt);
    if (!shown && row.createdById !== viewerId) return [];
    return [
      {
        id: row.id,
        isGroup: row.isGroup,
        name: row.name,
        members: people
          .filter((p) => p.conversationId === row.id)
          .map((p) => ({
            id: p.id,
            username: p.username,
            firstName: p.firstName,
            lastName: p.lastName,
            profilePicture: p.profilePicture,
          })),
        lastMessage: shown
          ? {
              senderId: last.senderId,
              text: last.text,
              kind: last.postId
                ? ("post" as const)
                : last.storyId
                  ? ("story" as const)
                  : last.media?.type?.startsWith("audio/")
                    ? ("voice" as const)
                    : last.media
                      ? ("media" as const)
                      : ("text" as const),
              createdAt: last.createdAt.toISOString(),
            }
          : null,
        unread:
          !!shown && last.senderId !== viewerId && last.createdAt > row.lastReadAt,
      },
    ];
  });
}

export type ChatListItem = Awaited<ReturnType<typeof getChats>>[number];

/**
 * Unread in the inbox counts people, not messages: 1k unread messages from one
 * person is 1. `senders` are the newest few of them, for avatars. Requests
 * count chats waiting to be answered.
 */
export async function getUnreadCounts(viewerId: string) {
  const unseen = and(
    ne(messages.senderId, viewerId),
    gt(messages.createdAt, members.lastReadAt),
    or(isNull(members.clearedAt), gt(messages.createdAt, members.clearedAt)),
  );
  const [senders, [requests]] = await Promise.all([
    db
      .select({ ...preview, last: sql<Date>`max(${messages.createdAt})` })
      .from(messages)
      .innerJoin(
        members,
        and(
          eq(members.conversationId, messages.conversationId),
          eq(members.userId, viewerId),
          eq(members.accepted, true),
        ),
      )
      .innerJoin(users, eq(users.id, messages.senderId))
      .where(unseen)
      .groupBy(users.id)
      .orderBy(desc(sql`max(${messages.createdAt})`)),
    db
      .select({ n: count() })
      .from(members)
      .where(
        and(
          eq(members.userId, viewerId),
          eq(members.accepted, false),
          exists(
            db
              .select({ id: messages.id })
              .from(messages)
              .where(and(eq(messages.conversationId, members.conversationId), unseen)),
          ),
        ),
      ),
  ]);
  return {
    inbox: senders.length,
    requests: requests?.n ?? 0,
    senders: senders.slice(0, 3).map((s) => ({
      id: s.id,
      username: s.username,
      firstName: s.firstName,
      lastName: s.lastName,
      profilePicture: s.profilePicture,
    })),
  };
}

/** The chat's header: who's in it, how far each has read, and whether you can write. */
export async function getChat(viewerId: string, conversationId: string) {
  const member = await mustBeMember(viewerId, conversationId);
  const people = await db
    .select({ ...preview, lastReadAt: members.lastReadAt })
    .from(members)
    .innerJoin(users, eq(users.id, members.userId))
    .where(
      and(eq(members.conversationId, conversationId), ne(members.userId, viewerId)),
    );
  const blocked =
    !member.isGroup && people[0]
      ? await isBlockedEitherWay(viewerId, people[0].id)
      : false;
  return {
    id: conversationId,
    isGroup: member.isGroup,
    name: member.name,
    accepted: member.accepted,
    blocked,
    members: people.map((p) => ({ ...p, lastReadAt: p.lastReadAt.toISOString() })),
  };
}

export type ChatDetail = Awaited<ReturnType<typeof getChat>>;

/**
 * A page of messages, newest first, older than `before` (an ISO time). Shared
 * posts come back as the feed renders them, or null when the viewer may not
 * see them (private, archived, deleted).
 */
export async function getMessages(
  viewerId: string,
  conversationId: string,
  before?: string,
) {
  const member = await mustBeMember(viewerId, conversationId);
  const rows = await db
    .select({
      id: messages.id,
      senderId: messages.senderId,
      text: messages.text,
      postId: messages.postId,
      media: messages.media,
      replyToId: messages.replyToId,
      createdAt: messages.createdAt,
      sender: preview,
      story: {
        id: stories.id,
        url: stories.url,
        type: stories.type,
        cover: stories.cover,
        createdAt: stories.createdAt,
      },
    })
    .from(messages)
    .innerJoin(users, eq(users.id, messages.senderId))
    .leftJoin(stories, eq(stories.id, messages.storyId))
    .where(
      and(
        eq(messages.conversationId, conversationId),
        sinceCleared(member.clearedAt),
        before ? lt(messages.createdAt, new Date(before)) : undefined,
      ),
    )
    .orderBy(desc(messages.createdAt))
    .limit(MESSAGE_PAGE_SIZE + 1);
  const page = rows.slice(0, MESSAGE_PAGE_SIZE);
  const ids = page.map((m) => m.id);
  const postIds = [...new Set(page.flatMap((m) => (m.postId ? [m.postId] : [])))];
  const replyIds = [...new Set(page.flatMap((m) => (m.replyToId ? [m.replyToId] : [])))];

  const [likes, shared, quoted] = await Promise.all([
    ids.length
      ? db
          .select({ messageId: messageLikes.messageId, userId: messageLikes.userId })
          .from(messageLikes)
          .where(inArray(messageLikes.messageId, ids))
      : [],
    postIds.length
      ? findPosts(
          viewerId,
          and(inArray(posts.id, postIds), visibleTo(viewerId)),
          postIds.length,
        ).then((r) => r.posts)
      : [],
    // The messages being replied to, as a one-line preview each.
    replyIds.length
      ? db
          .select({
            id: messages.id,
            senderId: messages.senderId,
            username: users.username,
            text: messages.text,
            postId: messages.postId,
            mediaType: sql<string | null>`${messages.media}->>'type'`,
          })
          .from(messages)
          .innerJoin(users, eq(users.id, messages.senderId))
          .where(inArray(messages.id, replyIds))
      : [],
  ]);

  return {
    messages: page.map(({ postId, story, replyToId, ...m }) => ({
      ...m,
      replyTo: (() => {
        const q = quoted.find((r) => r.id === replyToId);
        return q
          ? {
              id: q.id,
              senderId: q.senderId,
              username: q.username,
              text: q.text,
              kind: q.postId
                ? ("post" as const)
                : q.mediaType?.startsWith("audio/")
                  ? ("voice" as const)
                  : q.mediaType
                    ? ("media" as const)
                    : ("text" as const),
            }
          : null;
      })(),
      createdAt: m.createdAt.toISOString(),
      // A reply to a story: its thumbnail while it's live, like Instagram.
      story: story
        ? {
            id: story.id,
            thumb:
              Date.now() - story.createdAt.getTime() < STORY_TTL_MS
                ? story.type?.startsWith("video/")
                  ? (story.cover?.url ?? null)
                  : story.url
                : null,
          }
        : null,
      shared: postId !== null,
      post: (shared.find((p) => p.id === postId) ?? null) as FeedPost | null,
      likes: likes.filter((l) => l.messageId === m.id).map((l) => l.userId),
    })),
    nextBefore:
      rows.length > MESSAGE_PAGE_SIZE ? page.at(-1)!.createdAt.toISOString() : null,
  };
}

export type ChatMessage = Awaited<
  ReturnType<typeof getMessages>
>["messages"][number] & {
  /** Client only: sent, not yet confirmed. */
  pending?: boolean;
};

/**
 * The 1:1 chat between the viewer and `otherId`, created on first use. It
 * lands in their Requests unless they follow the viewer.
 */
export async function openDirect(viewerId: string, otherId: string) {
  if (otherId === viewerId) throw new ChatError("You can't message yourself.", 400);
  const [other] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, otherId))
    .limit(1);
  if (!other) throw new ChatError("Account not found.", 404);
  if (await isBlockedEitherWay(viewerId, otherId)) {
    throw new ChatError("You can't message this account.", 403);
  }

  const [existing] = await db
    .select({ id: members.conversationId })
    .from(members)
    .innerJoin(conversations, eq(conversations.id, members.conversationId))
    .where(and(eq(conversations.isGroup, false), inArray(members.userId, [viewerId, otherId])))
    .groupBy(members.conversationId)
    .having(sql`count(*) = 2`)
    .limit(1);
  if (existing) return existing.id;

  // ponytail: two people opening the same chat at once can end up with two;
  // a unique pair key would stop it if that shows up.
  const [created] = await db
    .insert(conversations)
    .values({ createdById: viewerId })
    .returning({ id: conversations.id });
  await db.insert(members).values([
    { conversationId: created!.id, userId: viewerId },
    {
      conversationId: created!.id,
      userId: otherId,
      accepted: await follows(otherId, viewerId),
    },
  ]);
  return created!.id;
}

/** A group with the viewer and `userIds`; for each, a request unless they follow the viewer. */
export async function createGroup(viewerId: string, userIds: string[], name?: string) {
  const ids = [...new Set(userIds)].filter((id) => id !== viewerId);
  if (ids.length < 2 || ids.length >= GROUP_MAX) {
    throw new ChatError(`A group has 3 to ${GROUP_MAX} people.`, 400);
  }
  const [found, blocks, followers] = await Promise.all([
    db.select({ id: users.id }).from(users).where(inArray(users.id, ids)),
    Promise.all(ids.map((id) => isBlockedEitherWay(viewerId, id))),
    db
      .select({ id: userFollows.followerId })
      .from(userFollows)
      .where(and(eq(userFollows.followingId, viewerId), inArray(userFollows.followerId, ids))),
  ]);
  if (found.length !== ids.length || blocks.some(Boolean)) {
    throw new ChatError("Some of these accounts can't be added.", 400);
  }
  const [created] = await db
    .insert(conversations)
    .values({ createdById: viewerId, isGroup: true, name: name?.trim() || null })
    .returning({ id: conversations.id });
  await db.insert(members).values([
    { conversationId: created!.id, userId: viewerId },
    ...ids.map((userId) => ({
      conversationId: created!.id,
      userId,
      accepted: followers.some((f) => f.id === userId),
    })),
  ]);
  await push(ids, CHAT_EVENT, { conversationId: created!.id });
  return created!.id;
}

export type MessageInput = {
  text?: string;
  postId?: string;
  media?: MediaCover;
  storyId?: string;
  /** Quote an earlier message of this chat; anything else is ignored. */
  replyToId?: string;
};

/** Posts to the chat; writing in a request accepts it. */
export async function sendMessage(
  viewerId: string,
  conversationId: string,
  input: MessageInput,
) {
  const member = await mustBeMember(viewerId, conversationId);
  const others = await otherMemberIds(conversationId, viewerId);
  if (!member.isGroup) {
    if (!others[0] || (await isBlockedEitherWay(viewerId, others[0]))) {
      throw new ChatError("You can't message this account.", 403);
    }
  }
  if (input.postId && !(await canViewPost(viewerId, input.postId))) {
    throw new ChatError("Post not found.", 404);
  }

  const now = new Date();
  const [message] = await db
    .insert(messages)
    .values({
      conversationId,
      senderId: viewerId,
      text: input.text || null,
      postId: input.postId,
      storyId: input.storyId,
      replyToId: input.replyToId
        ? (
            await db
              .select({ id: messages.id })
              .from(messages)
              .where(
                and(eq(messages.id, input.replyToId), eq(messages.conversationId, conversationId)),
              )
              .limit(1)
          )[0]?.id
        : undefined,
      media: input.media,
      createdAt: now,
    })
    .returning({ id: messages.id });
  await db.batch([
    db
      .update(conversations)
      .set({ lastMessageAt: now })
      .where(eq(conversations.id, conversationId)),
    db
      .update(members)
      .set({ accepted: true, lastReadAt: now })
      .where(and(eq(members.conversationId, conversationId), eq(members.userId, viewerId))),
  ]);
  await push([...others, viewerId], CHAT_EVENT, { conversationId });
  return message!.id;
}

/** Shares a post or reel into chats with each of `userIds` and each of `conversationIds`. */
export async function sharePost(
  viewerId: string,
  postId: string,
  targets: { userIds: string[]; conversationIds: string[]; text?: string },
) {
  if (!(await canViewPost(viewerId, postId))) throw new ChatError("Post not found.", 404);
  const direct = await Promise.all(targets.userIds.map((id) => openDirect(viewerId, id)));
  const ids = [...new Set([...direct, ...targets.conversationIds])];
  await Promise.all(
    ids.map(async (id) => {
      await sendMessage(viewerId, id, { postId });
      if (targets.text) await sendMessage(viewerId, id, { text: targets.text });
    }),
  );
  return ids;
}

/** Everything in the chat is seen as of now; the others' "Seen" updates. */
export async function markRead(viewerId: string, conversationId: string) {
  await mustBeMember(viewerId, conversationId);
  await db
    .update(members)
    .set({ lastReadAt: new Date() })
    .where(and(eq(members.conversationId, conversationId), eq(members.userId, viewerId)));
  await announce(conversationId, viewerId);
}

export async function acceptRequest(viewerId: string, conversationId: string) {
  await mustBeMember(viewerId, conversationId);
  await db
    .update(members)
    .set({ accepted: true })
    .where(and(eq(members.conversationId, conversationId), eq(members.userId, viewerId)));
}

/**
 * A 1:1 chat (or declined request) is cleared for the viewer only and comes
 * back if they're written to again; a group is left.
 */
export async function removeChat(viewerId: string, conversationId: string) {
  const member = await mustBeMember(viewerId, conversationId);
  const mine = and(
    eq(members.conversationId, conversationId),
    eq(members.userId, viewerId),
  );
  if (!member.isGroup) {
    await db.update(members).set({ clearedAt: new Date() }).where(mine);
    return;
  }
  await db.delete(members).where(mine);
  const left = await otherMemberIds(conversationId, viewerId);
  if (!left.length) {
    await db.delete(conversations).where(eq(conversations.id, conversationId));
    return;
  }
  await push([...left, viewerId], CHAT_EVENT, { conversationId });
}

/** Unsend: only your own messages. Returns the media key to delete, if any. */
export async function unsendMessage(viewerId: string, messageId: string) {
  if (!UUID.test(messageId)) throw new ChatError("Message not found.", 404);
  const [gone] = await db
    .delete(messages)
    .where(and(eq(messages.id, messageId), eq(messages.senderId, viewerId)))
    .returning({ conversationId: messages.conversationId, media: messages.media });
  if (!gone) throw new ChatError("Message not found.", 404);
  await announce(gone.conversationId, viewerId);
  return gone.media?.key ?? null;
}

export async function setMessageLike(viewerId: string, messageId: string, liked: boolean) {
  if (!UUID.test(messageId)) throw new ChatError("Message not found.", 404);
  const [message] = await db
    .select({ conversationId: messages.conversationId })
    .from(messages)
    .where(eq(messages.id, messageId))
    .limit(1);
  if (!message) throw new ChatError("Message not found.", 404);
  await mustBeMember(viewerId, message.conversationId);
  const key = { messageId, userId: viewerId };
  if (liked) {
    await db.insert(messageLikes).values(key).onConflictDoNothing();
  } else {
    await db
      .delete(messageLikes)
      .where(and(eq(messageLikes.messageId, messageId), eq(messageLikes.userId, viewerId)));
  }
  await announce(message.conversationId, viewerId);
}

/** "typing…" for the others; clients drop it after a few seconds of silence. */
export async function sendTyping(viewerId: string, conversationId: string) {
  await mustBeMember(viewerId, conversationId);
  await push(await otherMemberIds(conversationId, viewerId), TYPING_EVENT, {
    conversationId,
    userId: viewerId,
  });
}
