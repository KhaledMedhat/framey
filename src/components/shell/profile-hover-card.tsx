"use client";

import { useState } from "react";
import Link from "next/link";
import { Camera, Link2, Lock, UserBlock } from "reicon-react";

import { AccountVisibility } from "@/interfaces/general.interface";
import { getFullName } from "@/lib/utils";
import {
  useProfilePreviewQuery,
  useSetBlockedMutation,
  type ApiError,
} from "@/store/api";
import { useLang, useT } from "../i18n-provider";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Button } from "../ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../ui/hover-card";
import { Spinner } from "../ui/spinner";
import { toast } from "../ui/toast";
import { compact, FollowButton } from "./follow-button";
import ProfileGrid from "./profile-grid";

/**
 * A link to someone's profile that, on hover, previews it the way the profile
 * page shows it: header, bio, the same two actions, and their last 3 posts
 * (or the same empty / private / blocked states). Fetched on first open.
 */
export function ProfileHoverCard({
  username,
  className,
  onClick,
  children,
}: {
  username: string;
  className?: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const t = useT();
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const [fetched, setFetched] = useState(false);
  // A post opened from the grid is a dialog outside the card: keep the card
  // mounted while it's up, or the dialog goes with it.
  const [postOpen, setPostOpen] = useState(false);
  const { data: profile, isError } = useProfilePreviewQuery(username, {
    skip: !fetched,
  });
  const [setBlocked, { isLoading: unblocking }] = useSetBlockedMutation();

  const unblock = async () => {
    const result = await setBlocked({ username, blocked: false });
    if ("error" in result) {
      toast.add({
        type: "error",
        description:
          (result.error as ApiError).data?.message ?? t("somethingWrong"),
      });
    }
  };

  return (
    <HoverCard
      open={open || postOpen}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setFetched(true);
      }}
    >
      <HoverCardTrigger
        delay={0}
        render={<Link href={`/${username}`} onClick={onClick} />}
        className={className}
      >
        {children}
      </HoverCardTrigger>
      <HoverCardContent className="w-80 overflow-hidden p-0">
        {!profile ? (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            {isError ? t("somethingWrong") : <Spinner />}
          </div>
        ) : (
          <div className="flex flex-col gap-3 pt-4">
            <div className="flex items-start gap-3 px-4">
              <Link
                href={`/${profile.username}`}
                className="shrink-0 rounded-full"
              >
                <Avatar className="size-14">
                  <AvatarImage
                    src={profile.profilePicture?.url}
                    alt={t("profilePictureOf", { name: profile.username })}
                  />
                  <AvatarFallback>
                    {`${profile.firstName[0]}${profile.lastName[0]}`.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Link>
              <div className="flex min-w-0 flex-1 flex-col text-sm">
                <div className="flex min-w-0 items-center gap-1.5">
                  <Link
                    href={`/${profile.username}`}
                    className="truncate font-semibold hover:underline"
                  >
                    {profile.username}
                  </Link>
                  {profile.visibility === AccountVisibility.PRIVATE && (
                    <Lock
                      aria-label={t("privateAccount")}
                      className="size-3.5 shrink-0 text-muted-foreground"
                    />
                  )}
                </div>
                <ul className="my-1 flex gap-2 text-start text-xs [&>li]:flex [&>li]:items-center [&>li]:gap-1 [&>li]:leading-tight [&>li]:text-foreground [&>li>span]:font-semibold [&>li>span]:tabular-nums [&>li>span]:text-xs">
                  <li>
                    <span>{compact(profile.counts.posts, lang)}</span>
                    {t(profile.counts.posts === 1 ? "post" : "posts")}
                  </li>
                  <li>
                    <span>{compact(profile.counts.followers, lang)}</span>
                    {t(
                      profile.counts.followers === 1 ? "follower" : "followers",
                    )}
                  </li>
                  <li>
                    <span>{compact(profile.counts.following, lang)}</span>
                    {t("followingCount")}
                  </li>
                </ul>
                <p className="truncate font-semibold">
                  {getFullName(profile.firstName, profile.lastName)}
                </p>
                {profile.followsMe && (
                  <span className="self-start rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                    {t("followsYou")}
                  </span>
                )}
                {profile.bio && (
                  <p className="line-clamp-2 whitespace-pre-line text-pretty">
                    {profile.bio}
                  </p>
                )}
                {profile.websites[0] && (
                  <a
                    href={profile.websites[0]}
                    target="_blank"
                    rel="noopener noreferrer nofollow ugc"
                    dir="ltr"
                    className="flex max-w-full items-center gap-1 self-start font-semibold text-blue-500 hover:underline"
                  >
                    <Link2 aria-hidden className="size-3.5 shrink-0" />
                    <span className="truncate">
                      {profile.websites[0]
                        .replace(/^https?:[/][/](www[.])?/, "")
                        .replace(/[/]$/, "")}
                    </span>
                    {profile.websites.length > 1 && (
                      <span className="shrink-0">+{profile.websites.length - 1}</span>
                    )}
                  </a>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 px-4">
              {profile.isMe ? (
                <>
                  <Button
                    size="sm"
                    variant="secondary"
                    nativeButton={false}
                    render={<Link href="/settings/edit-profile" />}
                  >
                    {t("editProfile")}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    nativeButton={false}
                    render={<Link href="/archive" />}
                  >
                    {t("viewArchive")}
                  </Button>
                </>
              ) : profile.blocked ? (
                <Button
                  size="sm"
                  disabled={unblocking}
                  onClick={() => void unblock()}
                  className="col-span-2"
                >
                  {t("unblock")}
                </Button>
              ) : (
                <>
                  {/* Keyed so a refetch after following resets its local state. */}
                  <FollowButton
                    key={`${profile.following}-${profile.requested}`}
                    username={profile.username}
                    following={profile.following}
                    requested={profile.requested}
                    followsMe={profile.followsMe}
                    size="sm"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    nativeButton={false}
                    render={<Link href="/direct" />}
                  >
                    {t("message")}
                  </Button>
                </>
              )}
            </div>

            {!profile.canView ? (
              <section className="flex flex-col items-center gap-1.5 border-t px-4 py-5 text-center">
                <span className="flex size-10 items-center justify-center rounded-full border">
                  {profile.blocked ? (
                    <UserBlock aria-hidden className="size-5" />
                  ) : (
                    <Lock aria-hidden className="size-5" />
                  )}
                </span>
                <h2 className="text-sm font-semibold">
                  {profile.blocked ? t("blockedTitle") : t("privateTitle")}
                </h2>
                <p className="text-xs text-pretty text-muted-foreground">
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
            ) : profile.posts.length ? (
              <ProfileGrid
                posts={profile.posts}
                onOpenChange={setPostOpen}
                className="md:grid-cols-3 md:gap-0.5 lg:grid-cols-3 xl:grid-cols-3"
              />
            ) : (
              <section className="flex flex-col items-center gap-1.5 border-t px-4 py-5 text-center">
                <Camera aria-hidden className="size-8 text-muted-foreground" />
                <h2 className="text-sm font-semibold">
                  {profile.isMe ? t("shareFirstMoment") : t("noPostsYet")}
                </h2>
                <p className="text-xs text-pretty text-muted-foreground">
                  {profile.isMe
                    ? t("noPostsMine")
                    : t("noPostsTheirs", { name: profile.firstName })}
                </p>
              </section>
            )}
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
