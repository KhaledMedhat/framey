import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, isNull, ne } from "drizzle-orm";

import FeedPost from "@/components/shell/feed-post";
import ProfileGrid from "@/components/shell/profile-grid";
import { postIdInputSchema } from "@/lib/validations";
import { auth } from "@/server/auth";
import { posts } from "@/server/db/schema";
import { findPosts, visibleTo } from "@/server/feed";
import { getT } from "@/server/i18n";

const MORE_POSTS = 12;

async function load(id: string) {
  const me = (await auth())!.user;
  const parsed = postIdInputSchema.safeParse(id);
  if (!parsed.success) return null;
  const {
    posts: [post],
  } = await findPosts(me.id, and(eq(posts.id, parsed.data), visibleTo(me.id)), 1);
  return post ? { me, post } : null;
}

export async function generateMetadata({
  params,
}: PageProps<"/p/[id]">): Promise<Metadata> {
  const loaded = await load((await params).id);
  const t = await getT();
  return {
    title: loaded
      ? t("postBy", { name: loaded.post.author.username })
      : t("pageNotFound"),
  };
}

/** One post as its details window shows it, then more from its author. */
export default async function PostPage({ params }: PageProps<"/p/[id]">) {
  const loaded = await load((await params).id);
  if (!loaded) notFound();
  const { me, post } = loaded;
  const [t, more] = await Promise.all([
    getT(),
    findPosts(
      me.id,
      and(
        eq(posts.authorId, post.author.id),
        ne(posts.id, post.id),
        isNull(posts.archivedAt),
        visibleTo(me.id),
      ),
      MORE_POSTS,
    ),
  ]);

  return (
    <div className="mx-auto flex w-full flex-col gap-10 pt-4 pb-12 md:px-8 md:pt-10">
      <FeedPost key={post.id} post={post} priority layout="modal" />
      {more.posts.length > 0 && (
        <section aria-labelledby="more-heading" className="mx-auto flex w-full max-w-6xl flex-col gap-4 border-t pt-8">
          <h2 id="more-heading" className="px-4 text-sm font-semibold text-muted-foreground md:px-0">
            {t("morePostsFrom")}{" "}
            <Link href={`/${post.author.username}`} className="text-foreground hover:underline">
              {post.author.username}
            </Link>
          </h2>
          <ProfileGrid posts={more.posts} className="md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3" />
        </section>
      )}
    </div>
  );
}
