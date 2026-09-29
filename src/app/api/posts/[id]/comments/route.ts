import { and, asc, eq, getTableName, isNull, sql } from "drizzle-orm";

import type { PostComment, PostComments } from "@/interfaces/post.interface";
import { commentInputSchema, postIdInputSchema } from "@/lib/validations";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { commentLikes, postComments } from "@/server/db/schema";
import { canViewPost } from "@/server/feed";
import { notify, notifyMentions } from "@/server/notifications";
import { rateLimit, tooManyRequests } from "@/server/ratelimit";

type Ctx = RouteContext<"/api/posts/[id]/comments">;

async function load(ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ message: "Sign in to see comments." }, { status: 401 });
  }
  const postId = postIdInputSchema.safeParse((await ctx.params).id);
  const post = postId.success
    ? await canViewPost(session.user.id, postId.data)
    : null;
  if (!post) {
    return Response.json({ message: "Post not found." }, { status: 404 });
  }
  return { userId: session.user.id, postId: postId.data!, post };
}

const author = {
  columns: { id: true, username: true, profilePicture: true },
} as const;
const columns = { id: true, content: true, gif: true, createdAt: true } as const;
// The relational builder renders a bare table in `extras` as empty text, so
// name it; and it rewrites columns to the outer alias, so alias our own.
const likesTable = sql.identifier(getTableName(commentLikes));
const likes = (viewerId: string) =>
  (table: { id: typeof postComments.id }) => ({
    likeCount:
      sql<number>`(select count(*) from ${likesTable} as cl where cl."commentId" = ${table.id})`.as(
        "like_count",
      ),
    likedByMe:
      sql<boolean>`exists(select 1 from ${likesTable} as cl where cl."commentId" = ${table.id} and cl."userId" = ${viewerId})`.as(
        "liked_by_me",
      ),
  });

/** Top-level comments oldest first, each with its replies oldest first. */
export async function GET(_: Request, ctx: Ctx) {
  const loaded = await load(ctx);
  if (loaded instanceof Response) return loaded;
  const rows = await db.query.postComments.findMany({
    where: and(
      eq(postComments.postId, loaded.postId),
      isNull(postComments.parentId),
    ),
    orderBy: asc(postComments.createdAt),
    // ponytail: every comment in one response; page it once posts draw hundreds.
    limit: 500,
    columns,
    extras: likes(loaded.userId),
    with: {
      author,
      replies: {
        orderBy: asc(postComments.createdAt),
        columns,
        extras: likes(loaded.userId),
        with: { author },
      },
    },
  });
  // count(*) arrives as a bigint string and `extras` skip mapWith.
  const toComment = ({
    createdAt,
    likeCount,
    likedByMe,
    ...comment
  }: Omit<PostComment, "createdAt" | "replies" | "likeCount" | "likedByMe"> & {
    createdAt: Date;
    likeCount: number;
    likedByMe: boolean;
  }): PostComment => ({
    ...comment,
    createdAt: createdAt.toISOString(),
    likeCount: Number(likeCount),
    likedByMe: likedByMe === true || String(likedByMe) === "true",
  });
  return Response.json({
    postAuthorId: loaded.post.authorId,
    comments: rows.map(({ replies, ...comment }) => ({
      ...toComment(comment),
      replies: replies.map(toComment),
    })),
  } satisfies PostComments);
}

/** `{ content, gif?, parentId? }`: a comment, or a reply under a top-level comment. */
export async function POST(request: Request, ctx: Ctx) {
  const loaded = await load(ctx);
  if (loaded instanceof Response) return loaded;
  const { userId, postId, post } = loaded;
  if (post.hideComments) {
    return Response.json(
      { message: "Commenting is turned off for this post." },
      { status: 403 },
    );
  }
  const retryAfter = await rateLimit("comment", userId);
  if (retryAfter) return tooManyRequests(retryAfter);

  const parsed = commentInputSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid comment." },
      { status: 400 },
    );
  }
  const { content, gif, parentId: replyTo } = parsed.data;

  // A reply to a reply joins the same thread under the top-level comment.
  const parent = replyTo
    ? await db.query.postComments.findFirst({
        where: and(
          eq(postComments.id, replyTo),
          eq(postComments.postId, postId),
        ),
        columns: { id: true, parentId: true, authorId: true },
      })
    : undefined;
  if (replyTo && !parent) {
    return Response.json({ message: "That comment is gone." }, { status: 404 });
  }

  const [comment] = await db
    .insert(postComments)
    .values({
      postId,
      authorId: userId,
      content,
      gif,
      parentId: parent ? (parent.parentId ?? parent.id) : null,
    })
    .returning({ id: postComments.id });
  const target = { postId, commentId: comment!.id };
  const toldDirectly = parent ? parent.authorId : post.authorId;
  await Promise.all([
    notify(toldDirectly, userId, parent ? "reply" : "comment", target),
    notifyMentions(content, userId, target, toldDirectly),
  ]);
  return Response.json({ id: comment!.id }, { status: 201 });
}
