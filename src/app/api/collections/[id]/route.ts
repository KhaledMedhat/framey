import { and, eq } from "drizzle-orm";
import z from "zod";

import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { savedCollections } from "@/server/db/schema";

/** Deletes the collection; its posts stay saved under All posts. */
export async function DELETE(
  _: Request,
  ctx: RouteContext<"/api/collections/[id]">,
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ message: "Sign in first." }, { status: 401 });
  }
  const id = z.uuid().safeParse((await ctx.params).id);
  const deleted = id.success
    ? await db
        .delete(savedCollections)
        .where(
          and(
            eq(savedCollections.id, id.data),
            eq(savedCollections.userId, session.user.id),
          ),
        )
        .returning({ id: savedCollections.id })
    : [];
  return deleted.length
    ? Response.json({ ok: true })
    : Response.json({ message: "Collection not found." }, { status: 404 });
}
