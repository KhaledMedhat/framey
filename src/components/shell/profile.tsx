import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { Lock, UserBlock } from "reicon-react";

import { getFullName } from "@/lib/utils";
import { auth } from "@/server/auth";
import { getT } from "@/server/i18n";
import {
  getProfile,
  getProfilePosts,
  getReposts,
  getSaved,
} from "@/server/profile";
import {
  getArchivedStories,
  getHighlights,
  getUserStories,
} from "@/server/stories";
import ProfileHeader from "./profile-header";
import ProfileTabs from "./profile-tabs";
import { Highlights } from "./stories";

// The proxy guarantees a signed-in user on every shell page.
const viewerId = async () => (await auth())!.user.id;

export async function profileMetadata(username: string): Promise<Metadata> {
  const user = await getProfile(await viewerId(), username.toLowerCase());
  return {
    title: user
      ? `${getFullName(user.firstName, user.lastName)} (@${user.username})`
      : (await getT())("pageNotFound"),
  };
}

export default async function Profile({ username }: { username: string }) {
  // Usernames are stored lowercase: one canonical URL per profile.
  const canonical = username.toLowerCase();
  if (canonical !== username) permanentRedirect(`/${canonical}`);

  const viewer = await viewerId();
  const profile = await getProfile(viewer, canonical);
  if (!profile) notFound();

  const t = await getT();
  const visible = profile.canView;
  const [posts, reels, reposts, tagged, saved, highlights, stories, archive] =
    await Promise.all([
      visible ? getProfilePosts(viewer, profile.id, "posts") : null,
      visible ? getProfilePosts(viewer, profile.id, "reels") : null,
      visible ? getReposts(viewer, profile.id) : null,
      visible ? getProfilePosts(viewer, profile.id, "tagged") : null,
      profile.isMe ? getSaved(viewer) : null,
      visible ? getHighlights(viewer, profile.id) : [],
      profile.hasStory ? getUserStories(viewer, profile.id) : [],
      profile.isMe ? getArchivedStories(viewer) : null,
    ]);

  return (
    <div className="mx-auto w-full max-w-screen-2xl pb-10 md:px-8">
      <ProfileHeader profile={profile} stories={stories} />

      {visible ? (
        <>
          <div className="mt-6">
            <Highlights
              user={{
                id: profile.id,
                username: profile.username,
                profilePicture: profile.profilePicture,
              }}
              highlights={highlights}
              archive={archive}
            />
          </div>
          <ProfileTabs
            isMe={profile.isMe}
            name={profile.isMe ? "you" : profile.firstName}
            posts={posts?.posts ?? []}
            reels={reels?.posts ?? []}
            reposts={reposts ?? []}
            tagged={tagged?.posts ?? []}
            saved={saved}
          />
        </>
      ) : (
        <section
          aria-labelledby="private-heading"
          className="mt-8 flex flex-col items-center gap-3 border-t px-6 py-20 text-center md:mt-10"
        >
          <span className="flex size-16 items-center justify-center rounded-full border">
            {profile.blocked ? (
              <UserBlock aria-hidden className="size-7" />
            ) : (
              <Lock aria-hidden className="size-7" />
            )}
          </span>
          <h2 id="private-heading" className="text-xl font-bold tracking-tight">
            {profile.blocked ? t("blockedTitle") : t("privateTitle")}
          </h2>
          <p className="max-w-xs text-sm text-pretty text-muted-foreground">
            {t(
              profile.blocked
                ? "blockedBody"
                : profile.requested
                  ? "privateRequested"
                  : "privateFollow",
              { name: profile.firstName },
            )}
          </p>
        </section>
      )}
    </div>
  );
}
