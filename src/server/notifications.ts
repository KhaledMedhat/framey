import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import Pusher from "pusher";

import { isBlockedEitherWay } from "@/server/blocks";
import { db } from "@/server/db";
import {
  notifications,
  postMedia,
  users,
  type NotificationType,
} from "@/server/db/schema";

const pusher =
  process.env.PUSHER_APP_ID &&
  process.env.PUSHER_SECRET &&
  process.env.NEXT_PUBLIC_PUSHER_KEY &&
  process.env.NEXT_PUBLIC_PUSHER_CLUSTER
    ? new Pusher({
        appId: process.env.PUSHER_APP_ID,
        key: process.env.NEXT_PUBLIC_PUSHER_KEY,
        secret: process.env.PUSHER_SECRET,
        cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
        useTLS: true,
      })
    : null;

/** Only its owner may subscribe (see /api/pusher/auth). */
export const userChannel = (userId: string) => `private-user-${userId}`;
export const NOTIFICATION_EVENT = "notification";

export function authorizeChannel(socketId: string, channel: string) {
  return pusher?.authorizeChannel(socketId, channel) ?? null;
}

/**
 * Tells the recipient's open tabs their notifications changed; they refetch.
 * A Pusher outage mustn't fail the like or comment that caused it.
 */
const ping = (userId: string) =>
  pusher?.trigger(userChannel(userId), NOTIFICATION_EVENT, {}).catch(() => {});

/** Sends `event` to each user's open tabs; best effort, like `ping`. */
export const push = (userIds: string[], event: string, data: object) =>
  pusher && userIds.length
    ? pusher.trigger(userIds.map(userChannel), event, data).catch(() => {})
    : undefined;

type Target = { postId?: string; commentId?: string };

export async function notify(
  userId: string,
  actorId: string,
  type: NotificationType,
  target: Target = {},
) {
  if (userId === actorId) return;
  // Blocked people never hear from each other.
  if (await isBlockedEitherWay(userId, actorId)) return;
  await db.insert(notifications).values({ userId, actorId, type, ...target });
  await ping(userId);
}

/** Takes back what `notify` sent: an unlike, an unfollow, a withdrawn request. */
export async function unnotify(
  userId: string,
  actorId: string,
  type: NotificationType,
  target: Target = {},
) {
  const deleted = await db
    .delete(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.actorId, actorId),
        eq(notifications.type, type),
        target.postId ? eq(notifications.postId, target.postId) : undefined,
      ),
    )
    .returning({ id: notifications.id });
  if (deleted.length) await ping(userId);
}

const MENTION = /@([a-z0-9_]{1,30})/gi;

/**
 * Notifies everyone `@named` in a caption or comment, at most 20 per text,
 * except `skip` (already told about it another way).
 */
export async function notifyMentions(
  text: string,
  actorId: string,
  target: Target,
  skip?: string,
) {
  const names = [
    ...new Set([...text.matchAll(MENTION)].map((m) => m[1]!.toLowerCase())),
  ].slice(0, 20);
  if (!names.length) return;
  const mentioned = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.username, names));
  await Promise.all(
    mentioned
      .filter((u) => u.id !== skip)
      .map((u) => notify(u.id, actorId, "mention", target)),
  );
}

/** The newest 50, with who did it and a thumbnail of the post it's about. */
export async function getNotifications(userId: string) {
  const [items, [unread]] = await Promise.all([
    db.query.notifications.findMany({
      where: eq(notifications.userId, userId),
      orderBy: desc(notifications.createdAt),
      limit: 50,
      columns: { id: true, type: true, read: true, createdAt: true },
      with: {
        actor: {
          columns: { id: true, username: true, profilePicture: true },
        },
        post: {
          columns: { id: true },
          with: {
            media: {
              where: eq(postMedia.order, 0),
              orderBy: asc(postMedia.order),
              columns: { url: true, type: true, cover: true },
            },
          },
        },
        comment: { columns: { content: true } },
      },
    }),
    unreadWhere(userId),
  ]);
  return {
    unread: unread?.n ?? 0,
    items: items.map(({ post, comment, createdAt, ...item }) => {
      const first = post?.media[0];
      return {
        ...item,
        createdAt: createdAt.toISOString(),
        postId: post?.id ?? null,
        thumbnail: first?.type?.startsWith("video/")
          ? (first.cover?.url ?? null)
          : (first?.url ?? null),
        comment: comment?.content ?? null,
      };
    }),
  };
}

const unreadWhere = (userId: string) =>
  db
    .select({ n: count() })
    .from(notifications)
    .where(
      and(eq(notifications.userId, userId), eq(notifications.read, false)),
    );

/** One notification, opened by its owner. */
export const markRead = (userId: string, id: string) =>
  db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));

export const markAllRead = (userId: string) =>
  db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
