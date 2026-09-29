import { and, count, eq } from "drizzle-orm";

import { postIdInputSchema } from "@/lib/validations";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { postReposts } from "@/server/db/schema";
import { canViewPost } from "@/server/feed";
import { notify, unnotify } from "@/server/notifications";

type Ctx = RouteContext<"/api/posts/[id]/repost">;

/** Repost onto your profile and your followers' feeds; your own posts can't be. */
async function toggle(reposted: boolean, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ message: "Sign in to repost." }, { status: 401 });
  }
  const postId = postIdInputSchema.safeParse((await ctx.params).id);
  const post = postId.success
    ? await canViewPost(session.user.id, postId.data)
    : null;
  if (!post) {
    return Response.json({ message: "Post not found." }, { status: 404 });
  }
  if (post.authorId === session.user.id) {
    return Response.json({ message: "You can't repost your own post." }, { status: 400 });
  }

  const key = { userId: session.user.id, postId: postId.data! };
  const target = { postId: key.postId };
  if (reposted) {
    const [created] = await db
      .insert(postReposts)
      .values(key)
      .onConflictDoNothing()
      .returning({ id: postReposts.postId });
    if (created) await notify(post.authorId, key.userId, "repost", target);
  } else {
    await db
      .delete(postReposts)
      .where(and(eq(postReposts.userId, key.userId), eq(postReposts.postId, key.postId)));
    await unnotify(post.authorId, key.userId, "repost", target);
  }

  const [{ repostCount }] = await db
    .select({ repostCount: count() })
    .from(postReposts)
    .where(eq(postReposts.postId, key.postId));
  return Response.json({ reposted, repostCount });
}

export const POST = (_: Request, ctx: Ctx) => toggle(true, ctx);
export const DELETE = (_: Request, ctx: Ctx) => toggle(false, ctx);
