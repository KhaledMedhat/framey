import { and, count, eq } from "drizzle-orm";
import z from "zod";

import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { commentLikes, postComments } from "@/server/db/schema";
import { canViewPost } from "@/server/feed";

async function toggle(
  liked: boolean,
  ctx: RouteContext<"/api/comments/[id]/like">,
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ message: "Sign in to like comments." }, { status: 401 });
  }
  const userId = session.user.id;
  const id = z.uuid().safeParse((await ctx.params).id);
  const comment = id.success
    ? await db.query.postComments.findFirst({
        where: eq(postComments.id, id.data),
        columns: { id: true, postId: true },
      })
    : undefined;
  if (!comment || !(await canViewPost(userId, comment.postId))) {
    return Response.json({ message: "Comment not found." }, { status: 404 });
  }

  if (liked) {
    await db
      .insert(commentLikes)
      .values({ userId, commentId: comment.id })
      .onConflictDoNothing();
  } else {
    await db
      .delete(commentLikes)
      .where(
        and(eq(commentLikes.userId, userId), eq(commentLikes.commentId, comment.id)),
      );
  }

  const [{ likeCount }] = await db
    .select({ likeCount: count() })
    .from(commentLikes)
    .where(eq(commentLikes.commentId, comment.id));
  return Response.json({ liked, likeCount });
}

export const POST = (_: Request, ctx: RouteContext<"/api/comments/[id]/like">) =>
  toggle(true, ctx);
export const DELETE = (_: Request, ctx: RouteContext<"/api/comments/[id]/like">) =>
  toggle(false, ctx);
