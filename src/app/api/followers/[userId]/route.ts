import { and, eq } from "drizzle-orm";

import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { userFollows } from "@/server/db/schema";
import { unnotify } from "@/server/notifications";

type Ctx = RouteContext<"/api/followers/[userId]">;

/** Remove `userId` from the signed-in user's followers; quietly, like Instagram. */
export async function DELETE(_: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ message: "Sign in first." }, { status: 401 });
  }
  const followerId = (await ctx.params).userId;
  await db
    .delete(userFollows)
    .where(
      and(
        eq(userFollows.followerId, followerId),
        eq(userFollows.followingId, session.user.id),
      ),
    );
  await unnotify(session.user.id, followerId, "follow");
  return Response.json({ ok: true });
}
