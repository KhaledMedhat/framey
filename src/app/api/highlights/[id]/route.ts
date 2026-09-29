import { and, eq } from "drizzle-orm";
import z from "zod";

import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { highlights } from "@/server/db/schema";

/** Deletes the highlight; its stories stay in the archive. */
export async function DELETE(
  _: Request,
  ctx: RouteContext<"/api/highlights/[id]">,
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ message: "Sign in first." }, { status: 401 });
  }
  const id = z.uuid().safeParse((await ctx.params).id);
  const deleted = id.success
    ? await db
        .delete(highlights)
        .where(
          and(eq(highlights.id, id.data), eq(highlights.userId, session.user.id)),
        )
        .returning({ id: highlights.id })
    : [];
  return deleted.length
    ? Response.json({ ok: true })
    : Response.json({ message: "Highlight not found." }, { status: 404 });
}
