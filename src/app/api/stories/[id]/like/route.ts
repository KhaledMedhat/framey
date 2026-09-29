import { and, eq } from "drizzle-orm";
import z from "zod";

import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { storyLikes } from "@/server/db/schema";
import { canSeeStory } from "@/server/stories";

type Ctx = RouteContext<"/api/stories/[id]/like">;

/** Love a story (or take it back); its author sees who did. */
const toggle = (liked: boolean) => async (_: Request, ctx: Ctx) => {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ message: "Sign in first." }, { status: 401 });
  }
  const id = z.uuid().safeParse((await ctx.params).id);
  if (!id.success || !(await canSeeStory(session.user.id, id.data))) {
    return Response.json({ message: "Story not found." }, { status: 404 });
  }
  const key = { storyId: id.data, userId: session.user.id };
  if (liked) {
    await db.insert(storyLikes).values(key).onConflictDoNothing();
  } else {
    await db
      .delete(storyLikes)
      .where(and(eq(storyLikes.storyId, key.storyId), eq(storyLikes.userId, key.userId)));
  }
  return Response.json({ liked });
};

export const POST = toggle(true);
export const DELETE = toggle(false);
