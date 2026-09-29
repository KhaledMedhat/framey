import { and, eq } from "drizzle-orm";
import z from "zod";

import { postIdInputSchema } from "@/lib/validations";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { postMedia, posts } from "@/server/db/schema";
import { utapi } from "@/server/uploadthing";

type Ctx = RouteContext<"/api/posts/[id]">;

/** The signed-in author's post, or the error response. */
async function load(ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ message: "Sign in first." }, { status: 401 });
  }
  const id = postIdInputSchema.safeParse((await ctx.params).id);
  const [post] = id.success
    ? await db
        .select({ id: posts.id })
        .from(posts)
        .where(and(eq(posts.id, id.data), eq(posts.authorId, session.user.id)))
        .limit(1)
    : [];
  return post ?? Response.json({ message: "Post not found." }, { status: 404 });
}

/** `{ archived }`: archive a post (only you see it) or restore it. */
export async function PATCH(request: Request, ctx: Ctx) {
  const post = await load(ctx);
  if (post instanceof Response) return post;
  const body = z
    .object({ archived: z.boolean() })
    .safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return Response.json({ message: "Invalid input." }, { status: 400 });
  }
  await db
    .update(posts)
    .set({ archivedAt: body.data.archived ? new Date() : null })
    .where(eq(posts.id, post.id));
  return Response.json({ archived: body.data.archived });
}

/** Deletes the post everywhere; likes, comments and saves cascade with it. */
export async function DELETE(_: Request, ctx: Ctx) {
  const post = await load(ctx);
  if (post instanceof Response) return post;
  const media = await db
    .select({ key: postMedia.key, cover: postMedia.cover })
    .from(postMedia)
    .where(eq(postMedia.postId, post.id));
  await db.delete(posts).where(eq(posts.id, post.id));
  const keys = media.flatMap((m) => [m.key, m.cover?.key]).filter((k) => !!k);
  if (keys.length) await utapi.deleteFiles(keys as string[]).catch(() => {});
  return Response.json({ ok: true });
}
