import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "reicon-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProfileGrid from "@/components/shell/profile-grid";
import { StoryArchive } from "@/components/shell/stories";
import { auth } from "@/server/auth";
import { getT } from "@/server/i18n";
import { getArchivedPosts } from "@/server/profile";
import { getArchivedStories } from "@/server/stories";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("archive") };
}

/** Your archive: every story you've shared, and posts you've archived. */
export default async function ArchivePage() {
  // The proxy guarantees a signed-in user here.
  const me = (await auth())!.user;
  const [t, stories, posts] = await Promise.all([
    getT(),
    getArchivedStories(me.id),
    getArchivedPosts(me.id),
  ]);

  return (
    <div className="mx-auto w-full max-w-screen-2xl px-0 pt-6 pb-10 md:px-8 md:pt-10">
      <header className="flex items-center gap-2 px-4 md:px-0">
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("backToProfile")}
          nativeButton={false}
          render={<Link href={`/${me.username}`} />}
        >
          <ArrowLeft aria-hidden className="rtl:rotate-180" />
        </Button>
        <h1 className="text-xl font-bold tracking-tight">{t("archive")}</h1>
      </header>
      <p className="mt-1 px-4 text-sm text-muted-foreground md:ms-11 md:px-0">
        {t("archiveNote")}
      </p>

      <Tabs defaultValue="stories" className="mt-6 gap-0">
        <TabsList
          variant="line"
          className="h-12 w-full justify-center gap-16 rounded-none border-b p-0"
        >
          <TabsTrigger value="stories" className="flex-none px-1">
            {t("stories")}
          </TabsTrigger>
          <TabsTrigger value="posts" className="flex-none px-1">
            {t("postsLabel")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="stories" className="pt-1">
          <StoryArchive
            user={{
              id: me.id,
              username: me.username,
              profilePicture: me.profilePicture,
            }}
            stories={stories}
          />
        </TabsContent>
        <TabsContent value="posts" className="pt-1">
          {posts.posts.length ? (
            <ProfileGrid posts={posts.posts} />
          ) : (
            <p className="px-6 py-20 text-center text-sm text-pretty text-muted-foreground">
              {t("archivePostsEmpty")}
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
