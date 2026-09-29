import { and, eq } from "drizzle-orm";
import z from "zod";

import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { stories } from "@/server/db/schema";
import { utapi } from "@/server/uploadthing";

/** Deletes one of your stories, from highlights and the archive too. */
export async function DELETE(_: Request, ctx: RouteContext<"/api/stories/[id]">) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ message: "Sign in first." }, { status: 401 });
  }
  const id = z.uuid().safeParse((await ctx.params).id);
  // Reposts show the same files: keep them while any repost does.
  const [shared] = id.success
    ? await db
        .select({ id: stories.id })
        .from(stories)
        .where(eq(stories.repostOfId, id.data))
        .limit(1)
    : [];
  const [story] = id.success
    ? await db
        .delete(stories)
        .where(and(eq(stories.id, id.data), eq(stories.authorId, session.user.id)))
        .returning({ key: stories.key, cover: stories.cover })
    : [];
  if (!story) {
    return Response.json({ message: "Story not found." }, { status: 404 });
  }
  // ponytail: files a repost kept alive leak once that repost goes too; sweep
  // unreferenced keys in a job if storage matters.
  const keys = shared ? [] : [story.key, story.cover?.key].filter((k): k is string => !!k);
  if (keys.length) await utapi.deleteFiles(keys).catch(() => {});
  return Response.json({ ok: true });
}
