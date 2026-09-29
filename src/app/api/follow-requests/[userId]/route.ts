import { and, eq } from "drizzle-orm";

import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { followRequests, notifications, userFollows } from "@/server/db/schema";
import { notify, unnotify } from "@/server/notifications";

type Ctx = RouteContext<"/api/follow-requests/[userId]">;

/** Removes the request `userId` sent the signed-in user; null if there was none. */
async function take(ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ message: "Sign in first." }, { status: 401 });
  }
  const requesterId = (await ctx.params).userId;
  const [request] = await db
    .delete(followRequests)
    .where(
      and(
        eq(followRequests.requesterId, requesterId),
        eq(followRequests.targetId, session.user.id),
      ),
    )
    .returning({ id: followRequests.requesterId });
  return request
    ? { targetId: session.user.id, requesterId }
    : Response.json({ message: "Request not found." }, { status: 404 });
}

/** Confirm: they follow you now, and hear about it. */
export async function POST(_: Request, ctx: Ctx) {
  const taken = await take(ctx);
  if (taken instanceof Response) return taken;
  const { targetId, requesterId } = taken;
  await db.batch([
    db
      .insert(userFollows)
      .values({ followerId: requesterId, followingId: targetId })
      .onConflictDoNothing(),
    // The request in your list turns into "started following you".
    db
      .update(notifications)
      .set({ type: "follow" })
      .where(
        and(
          eq(notifications.userId, targetId),
          eq(notifications.actorId, requesterId),
          eq(notifications.type, "follow_request"),
        ),
      ),
  ]);
  await notify(requesterId, targetId, "follow_accept");
  return Response.json({ ok: true });
}

/** Delete: quietly, like Instagram; they can ask again. */
export async function DELETE(_: Request, ctx: Ctx) {
  const taken = await take(ctx);
  if (taken instanceof Response) return taken;
  await unnotify(taken.targetId, taken.requesterId, "follow_request");
  return Response.json({ ok: true });
}
