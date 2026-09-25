import { and, count, eq } from "drizzle-orm";

import { postIdInputSchema } from "@/lib/validations";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { postLikes } from "@/server/db/schema";
import { canViewPost } from "@/server/feed";

async function toggle(
  liked: boolean,
  ctx: RouteContext<"/api/posts/[id]/like">,
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ message: "Sign in to like posts." }, { status: 401 });
  }
  const postId = postIdInputSchema.safeParse((await ctx.params).id);
  if (!postId.success || !(await canViewPost(session.user.id, postId.data))) {
    return Response.json({ message: "Post not found." }, { status: 404 });
  }

  const key = { userId: session.user.id, postId: postId.data };
  if (liked) {
    // Idempotent: a double-tap racing the heart button can't double-count.
    await db.insert(postLikes).values(key).onConflictDoNothing();
  } else {
    await db
      .delete(postLikes)
      .where(and(eq(postLikes.userId, key.userId), eq(postLikes.postId, key.postId)));
  }

  const [{ likeCount }] = await db
    .select({ likeCount: count() })
    .from(postLikes)
    .where(eq(postLikes.postId, key.postId));
  return Response.json({ liked, likeCount });
}

export const POST = (_: Request, ctx: RouteContext<"/api/posts/[id]/like">) =>
  toggle(true, ctx);
export const DELETE = (_: Request, ctx: RouteContext<"/api/posts/[id]/like">) =>
  toggle(false, ctx);
