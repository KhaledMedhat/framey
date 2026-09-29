import { and, asc, eq, inArray } from "drizzle-orm";
import z from "zod";

import { postIdInputSchema } from "@/lib/validations";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import {
  savedCollectionPosts,
  savedCollections,
  savedPosts,
} from "@/server/db/schema";
import { canViewPost } from "@/server/feed";

type Ctx = RouteContext<"/api/posts/[id]/save">;

async function load(ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ message: "Sign in to save posts." }, { status: 401 });
  }
  const postId = postIdInputSchema.safeParse((await ctx.params).id);
  if (!postId.success || !(await canViewPost(session.user.id, postId.data))) {
    return Response.json({ message: "Post not found." }, { status: 404 });
  }
  return { userId: session.user.id, postId: postId.data };
}

/** Whether it's saved, and each of the viewer's collections with or without it. */
async function state(userId: string, postId: string) {
  const [saved, collections, holding] = await Promise.all([
    db
      .select({ id: savedPosts.postId })
      .from(savedPosts)
      .where(and(eq(savedPosts.userId, userId), eq(savedPosts.postId, postId)))
      .limit(1),
    db
      .select({ id: savedCollections.id, name: savedCollections.name })
      .from(savedCollections)
      .where(eq(savedCollections.userId, userId))
      .orderBy(asc(savedCollections.createdAt)),
    db
      .select({ id: savedCollectionPosts.collectionId })
      .from(savedCollectionPosts)
      .where(
        and(
          eq(savedCollectionPosts.postId, postId),
          inArray(savedCollectionPosts.collectionId, mine(userId)),
        ),
      ),
  ]);
  const inside = new Set(holding.map((h) => h.id));
  return {
    saved: saved.length > 0,
    collections: collections.map((c) => ({ ...c, contains: inside.has(c.id) })),
  };
}

const mine = (userId: string) =>
  db
    .select({ id: savedCollections.id })
    .from(savedCollections)
    .where(eq(savedCollections.userId, userId));

const body = z.object({ collectionId: z.uuid().optional() });
const parse = async (request: Request) =>
  body.safeParse(await request.json().catch(() => ({})));

export async function GET(_: Request, ctx: Ctx) {
  const loaded = await load(ctx);
  if (loaded instanceof Response) return loaded;
  return Response.json(await state(loaded.userId, loaded.postId));
}

/** Saves the post; with `collectionId`, also files it in that collection. */
export async function POST(request: Request, ctx: Ctx) {
  const loaded = await load(ctx);
  if (loaded instanceof Response) return loaded;
  const input = await parse(request);
  if (!input.success) {
    return Response.json({ message: "Invalid input." }, { status: 400 });
  }
  const { userId, postId } = loaded;
  const { collectionId } = input.data;
  if (collectionId) {
    const [owned] = await db
      .select({ id: savedCollections.id })
      .from(savedCollections)
      .where(
        and(
          eq(savedCollections.id, collectionId),
          eq(savedCollections.userId, userId),
        ),
      )
      .limit(1);
    if (!owned) {
      return Response.json({ message: "Collection not found." }, { status: 404 });
    }
  }
  await db.batch([
    db.insert(savedPosts).values({ userId, postId }).onConflictDoNothing(),
    ...(collectionId
      ? [
          db
            .insert(savedCollectionPosts)
            .values({ collectionId, postId })
            .onConflictDoNothing(),
        ]
      : []),
  ]);
  return Response.json(await state(userId, postId));
}

/**
 * With `collectionId`: takes it out of that collection only. Without: unsaves
 * it, which also takes it out of every collection.
 */
export async function DELETE(request: Request, ctx: Ctx) {
  const loaded = await load(ctx);
  if (loaded instanceof Response) return loaded;
  const input = await parse(request);
  if (!input.success) {
    return Response.json({ message: "Invalid input." }, { status: 400 });
  }
  const { userId, postId } = loaded;
  const { collectionId } = input.data;
  const fromCollections = db
    .delete(savedCollectionPosts)
    .where(
      and(
        eq(savedCollectionPosts.postId, postId),
        inArray(savedCollectionPosts.collectionId, mine(userId)),
        collectionId
          ? eq(savedCollectionPosts.collectionId, collectionId)
          : undefined,
      ),
    );
  if (collectionId) await fromCollections;
  else {
    await db.batch([
      db
        .delete(savedPosts)
        .where(and(eq(savedPosts.userId, userId), eq(savedPosts.postId, postId))),
      fromCollections,
    ]);
  }
  return Response.json(await state(userId, postId));
}
