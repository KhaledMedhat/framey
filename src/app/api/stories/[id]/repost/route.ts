import { eq } from "drizzle-orm";
import z from "zod";

import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { stories } from "@/server/db/schema";
import { rateLimit, tooManyRequests } from "@/server/ratelimit";
import { canSeeStory } from "@/server/stories";

/**
 * Reposts someone's story to yours: the same photo or video and text, marked
 * with who it's from. Close-friends stories stay where they were shared.
 */
export async function POST(_: Request, ctx: RouteContext<"/api/stories/[id]/repost">) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ message: "Sign in first." }, { status: 401 });
  }
  const retryAfter = await rateLimit("createStory", userId);
  if (retryAfter) return tooManyRequests(retryAfter);

  const id = z.uuid().safeParse((await ctx.params).id);
  const visible = id.success ? await canSeeStory(userId, id.data) : null;
  const [original] = visible
    ? await db.select().from(stories).where(eq(stories.id, id.data!)).limit(1)
    : [];
  if (!original) {
    return Response.json({ message: "Story not found." }, { status: 404 });
  }
  if (original.authorId === userId) {
    return Response.json({ message: "That's already your story." }, { status: 400 });
  }
  if (original.closeFriends) {
    return Response.json(
      { message: "Close friends stories can't be reposted." },
      { status: 403 },
    );
  }

  const [story] = await db
    .insert(stories)
    .values({
      authorId: userId,
      url: original.url,
      // The files stay the original's: deleting this repost mustn't remove them.
      key: null,
      type: original.type,
      width: original.width,
      height: original.height,
      cover: original.cover && { ...original.cover, key: undefined },
      muted: original.muted,
      duration: original.duration,
      overlays: original.overlays,
      repostOfId: original.repostOfId ?? original.id,
      repostOfUserId: original.repostOfUserId ?? original.authorId,
    })
    .returning({ id: stories.id });
  return Response.json({ id: story!.id }, { status: 201 });
}
