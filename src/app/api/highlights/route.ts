import { and, eq, inArray } from "drizzle-orm";

import { highlightInputSchema } from "@/lib/validations";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { highlights, highlightStories, stories } from "@/server/db/schema";

/** `{ title, storyIds }`: a highlight from your own (live or archived) stories. */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ message: "Sign in first." }, { status: 401 });
  }
  const parsed = highlightInputSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid highlight." },
      { status: 400 },
    );
  }
  const own = await db
    .select({ id: stories.id })
    .from(stories)
    .where(
      and(
        eq(stories.authorId, session.user.id),
        inArray(stories.id, parsed.data.storyIds),
      ),
    );
  if (!own.length) {
    return Response.json({ message: "Pick at least one story." }, { status: 400 });
  }

  const id = crypto.randomUUID();
  await db.batch([
    db
      .insert(highlights)
      .values({ id, userId: session.user.id, title: parsed.data.title }),
    db
      .insert(highlightStories)
      .values(own.map((s) => ({ highlightId: id, storyId: s.id }))),
  ]);
  return Response.json({ id }, { status: 201 });
}
