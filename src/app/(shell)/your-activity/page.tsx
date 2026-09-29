import type { Metadata } from "next";

import { YourActivity } from "@/components/shell/activity";
import {
  getAccountHistory,
  getActivityComments,
  getActivityHighlights,
  getActivityLikes,
  getActivityPosts,
  getActivityReposts,
  getActivityStoryReplies,
  readFilter,
} from "@/server/activity";
import { auth } from "@/server/auth";
import { getT } from "@/server/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("yourActivity") };
}

/** Every section and tab loads here at once; the page switches between them locally. */
export default async function YourActivityPage({
  searchParams,
}: PageProps<"/your-activity">) {
  const me = (await auth())!.user;
  const filter = readFilter(await searchParams);
  const [likes, comments, reposts, storyReplies, posts, reels, highlights, history] =
    await Promise.all([
      getActivityLikes(me.id, filter),
      getActivityComments(me.id, filter),
      getActivityReposts(me.id, filter),
      getActivityStoryReplies(me.id, filter),
      getActivityPosts(me.id, "posts", filter),
      getActivityPosts(me.id, "reels", filter),
      getActivityHighlights(me.id, me.username, filter),
      getAccountHistory(me.id, filter),
    ]);
  return (
    <div className="mx-auto w-full max-w-5xl md:px-6 md:py-8">
      <YourActivity
        filter={filter}
        likes={likes}
        comments={comments}
        reposts={reposts}
        storyReplies={storyReplies}
        posts={posts}
        reels={reels}
        highlights={highlights}
        history={history}
      />
    </div>
  );
}
