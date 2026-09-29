import { and, eq, or } from "drizzle-orm";

import { auth } from "@/server/auth";
import { db } from "@/server/db";
import {
  closeFriends,
  followRequests,
  notifications,
  userBlocks,
  userFollows,
  users,
} from "@/server/db/schema";

type Ctx = RouteContext<"/api/users/[username]/block">;

/** Both directions of a two-person table, e.g. follows either way. */
const between = (
  a: Parameters<typeof eq>[0],
  b: Parameters<typeof eq>[0],
  x: string,
  y: string,
) => or(and(eq(a, x), eq(b, y)), and(eq(a, y), eq(b, x)));

async function toggle(block: boolean, ctx: Ctx) {
  const session = await auth();
  const me = session?.user?.id;
  if (!me) {
    return Response.json({ message: "Sign in first." }, { status: 401 });
  }
  const username = decodeURIComponent((await ctx.params).username).toLowerCase();
  const target = await db.query.users.findFirst({
    where: eq(users.username, username),
    columns: { id: true },
  });
  if (!target) {
    return Response.json({ message: "Account not found." }, { status: 404 });
  }
  if (target.id === me) {
    return Response.json({ message: "You can't block yourself." }, { status: 400 });
  }

  if (!block) {
    await db
      .delete(userBlocks)
      .where(and(eq(userBlocks.blockerId, me), eq(userBlocks.blockedId, target.id)));
    return Response.json({ blocked: false });
  }

  // Blocking cuts every tie: follows, requests, close friends and whatever
  // they already told each other.
  await db.batch([
    db
      .insert(userBlocks)
      .values({ blockerId: me, blockedId: target.id })
      .onConflictDoNothing(),
    db
      .delete(userFollows)
      .where(between(userFollows.followerId, userFollows.followingId, me, target.id)),
    db
      .delete(followRequests)
      .where(
        between(followRequests.requesterId, followRequests.targetId, me, target.id),
      ),
    db
      .delete(closeFriends)
      .where(between(closeFriends.userId, closeFriends.friendId, me, target.id)),
    db
      .delete(notifications)
      .where(between(notifications.userId, notifications.actorId, me, target.id)),
  ]);
  return Response.json({ blocked: true });
}

export const POST = (_: Request, ctx: Ctx) => toggle(true, ctx);
export const DELETE = (_: Request, ctx: Ctx) => toggle(false, ctx);
