import { eq } from "drizzle-orm";
import z from "zod";

import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { postComments } from "@/server/db/schema";

/** Its author or the post's author may delete a comment; replies go with it. */
export async function DELETE(
  _: Request,
  ctx: RouteContext<"/api/comments/[id]">,
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ message: "Sign in first." }, { status: 401 });
  }
  const id = z.uuid().safeParse((await ctx.params).id);
  const comment = id.success
    ? await db.query.postComments.findFirst({
        where: eq(postComments.id, id.data),
        columns: { id: true, authorId: true },
        with: { post: { columns: { authorId: true } } },
      })
    : undefined;
  if (
    !comment ||
    (comment.authorId !== session.user.id &&
      comment.post.authorId !== session.user.id)
  ) {
    return Response.json({ message: "Comment not found." }, { status: 404 });
  }
  await db.delete(postComments).where(eq(postComments.id, comment.id));
  return Response.json({ ok: true });
}
