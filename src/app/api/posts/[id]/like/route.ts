import { and, count, eq } from "drizzle-orm";

import { postIdInputSchema } from "@/lib/validations";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { postLikes } from "@/server/db/schema";
import { canViewPost } from "@/server/feed";
import { notify, unnotify } from "@/server/notifications";

async function toggle(
  liked: boolean,
  ctx: RouteContext<"/api/posts/[id]/like">,
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ message: "Sign in to like posts." }, { status: 401 });
  }
  const postId = postIdInputSchema.safeParse((await ctx.params).id);
  const post = postId.success
    ? await canViewPost(session.user.id, postId.data)
    : null;
  if (!post) {
    return Response.json({ message: "Post not found." }, { status: 404 });
  }

  const key = { userId: session.user.id, postId: postId.data! };
  const target = { postId: key.postId };
  if (liked) {
    // Idempotent: a double-tap racing the heart button can't double-count.
    const [created] = await db
      .insert(postLikes)
      .values(key)
      .onConflictDoNothing()
      .returning({ id: postLikes.postId });
    if (created) await notify(post.authorId, key.userId, "like", target);
  } else {
    await db
      .delete(postLikes)
      .where(and(eq(postLikes.userId, key.userId), eq(postLikes.postId, key.postId)));
    await unnotify(post.authorId, key.userId, "like", target);
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
