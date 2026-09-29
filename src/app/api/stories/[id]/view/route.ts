import z from "zod";

import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { storyViews } from "@/server/db/schema";

/** Marks a story seen, so its ring greys out in the tray. */
export async function POST(
  _: Request,
  ctx: RouteContext<"/api/stories/[id]/view">,
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ message: "Sign in first." }, { status: 401 });
  }
  const id = z.uuid().safeParse((await ctx.params).id);
  if (!id.success) {
    return Response.json({ message: "Story not found." }, { status: 404 });
  }
  // Seen-state only: a bogus id fails the foreign key and changes nothing.
  await db
    .insert(storyViews)
    .values({ storyId: id.data, viewerId: session.user.id })
    .onConflictDoNothing()
    .catch(() => {});
  return Response.json({ ok: true });
}
