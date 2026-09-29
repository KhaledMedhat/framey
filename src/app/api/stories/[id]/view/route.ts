import z from "zod";

import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { storyViews } from "@/server/db/schema";
import { canSeeStory } from "@/server/stories";

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
  // Otherwise anyone could put themselves in any story's "Seen by" list.
  if (!id.success || !(await canSeeStory(session.user.id, id.data))) {
    return Response.json({ message: "Story not found." }, { status: 404 });
  }
  await db
    .insert(storyViews)
    .values({ storyId: id.data, viewerId: session.user.id })
    .onConflictDoNothing();
  return Response.json({ ok: true });
}
