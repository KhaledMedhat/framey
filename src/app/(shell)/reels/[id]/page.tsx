import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";

import Reels from "@/components/shell/reels";
import { postIdInputSchema } from "@/lib/validations";
import { auth } from "@/server/auth";
import { posts } from "@/server/db/schema";
import { findPosts, firstIsVideo, visibleTo } from "@/server/feed";
import { getT } from "@/server/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("reels") };
}

/** The linked reel first, then random ones, one per scroll. */
export default async function ReelPage({ params }: PageProps<"/reels/[id]">) {
  const me = (await auth())!.user;
  const id = postIdInputSchema.safeParse((await params).id);
  if (!id.success) notFound();
  const {
    posts: [reel],
  } = await findPosts(
    me.id,
    and(eq(posts.id, id.data), visibleTo(me.id), firstIsVideo()),
    1,
  );
  if (!reel) notFound();
  return <Reels key={reel.id} initial={reel} />;
}
