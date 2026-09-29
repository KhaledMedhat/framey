import { collectionInputSchema } from "@/lib/validations";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import {
  savedCollectionPosts,
  savedCollections,
  savedPosts,
} from "@/server/db/schema";
import { canViewPost } from "@/server/feed";

/** New named collection; with `postId`, the post is saved straight into it. */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ message: "Sign in to save posts." }, { status: 401 });
  }
  const parsed = collectionInputSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }
  const userId = session.user.id;
  const { name, postId } = parsed.data;
  if (postId && !(await canViewPost(userId, postId))) {
    return Response.json({ message: "Post not found." }, { status: 404 });
  }

  const id = crypto.randomUUID();
  await db.batch([
    db.insert(savedCollections).values({ id, userId, name }),
    ...(postId
      ? [
          db.insert(savedPosts).values({ userId, postId }).onConflictDoNothing(),
          db.insert(savedCollectionPosts).values({ collectionId: id, postId }),
        ]
      : []),
  ]);
  return Response.json({ id, name }, { status: 201 });
}
