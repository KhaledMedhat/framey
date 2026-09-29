"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Link2, Lock, MoreH, Search, Share, UserBlock } from "reicon-react";

import { AccountVisibility } from "@/interfaces/general.interface";
import type { Story } from "@/interfaces/story.interface";
import { cn, getFullName } from "@/lib/utils";
import type { Profile } from "@/server/profile";
import {
  useFollowListQuery,
  useRemoveFollowerMutation,
  useSetBlockedMutation,
  useSetFollowMutation,
  type ApiError,
  type FollowListAccount,
} from "@/store/api";
import type { Translate } from "@/lib/i18n";
import { useLang, useT } from "../i18n-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Input } from "../ui/input";
import { Spinner } from "../ui/spinner";
import { toast } from "../ui/toast";
import {
  hasUnseenCloseFriends,
  StoryViewer,
  storyRing,
  useStoryExpiry,
} from "./stories";
import { compact, FollowButton } from "./follow-button";
import { ProfileHoverCard } from "./profile-hover-card";

async function shareProfile(username: string, t: Translate) {
  const url = `${location.origin}/${username}`;
  if (navigator.share) {
    // Dismissing the share sheet rejects; that isn't an error.
    await navigator
      .share({ url, title: t("usernameOnFramey", { name: username }) })
      .catch(() => {});
    return;
  }
  await copyProfileLink(username, t);
}

async function copyProfileLink(username: string, t: Translate) {
  try {
    await navigator.clipboard.writeText(`${location.origin}/${username}`);
    toast.add({ description: t("profileLinkCopied") });
  } catch {
    toast.add({ type: "error", description: t("copyLinkFailed") });
  }
}

/**
 * Followers / following count that opens the list of people behind it. On
 * your own profile each row can unfollow / remove, behind a confirm.
 */
function FollowCount({
  username,
  list,
  count,
  enabled,
  isMe,
}: {
  username: string;
  list: "followers" | "following";
  count: number;
  enabled: boolean;
  isMe: boolean;
}) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [confirm, setConfirm] = useState<FollowListAccount | null>(null);
  const [gone, setGone] = useState<string[]>([]);
  const { data, isFetching, isError } = useFollowListQuery(
    { username, list },
    { skip: !open },
  );
  const [setFollow, { isLoading: unfollowing }] = useSetFollowMutation();
  const [removeFollower, { isLoading: removing }] = useRemoveFollowerMutation();
  const busy = unfollowing || removing;
  const label =
    list === "followers"
      ? t(count === 1 ? "follower" : "followers")
      : t("followingCount");
  const number = (
    <span className="font-semibold text-foreground tabular-nums">
      {compact(count, lang)}
    </span>
  );
  const q = query.trim().toLowerCase();
  const accounts = data?.filter(
    (a) =>
      !gone.includes(a.id) &&
      (a.username.includes(q) ||
        getFullName(a.firstName, a.lastName).toLowerCase().includes(q)),
  );

  const drop = async () => {
    if (!confirm) return;
    const result =
      list === "followers"
        ? await removeFollower(confirm.id)
        : await setFollow({ username: confirm.username, following: false });
    if ("error" in result) {
      toast.add({
        type: "error",
        description:
          (result.error as ApiError).data?.message ?? t("somethingWrong"),
      });
      return;
    }
    setGone((ids) => [...ids, confirm.id]);
    setConfirm(null);
    router.refresh();
  };

  if (!enabled || count === 0) {
    return (
      <span className="text-muted-foreground">
        {number} {label}
      </span>
    );
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery("");
        }}
      >
        <DialogTrigger
          render={
            <Button
              variant="link"
              onClick={() => setOpen(true)}
              className="h-auto p-0 text-xs font-normal text-muted-foreground hover:text-foreground hover:no-underline"
            >
              {number} {label}
            </Button>
          }
        />

        <DialogContent className="gap-0 overflow-hidden p-0 max-w-lg!">
          <DialogHeader className="h-12 flex-row items-center justify-center border-b px-4">
            <DialogTitle className="capitalize">{label}</DialogTitle>
          </DialogHeader>
          <div className="relative mx-4 mt-3">
            <Search
              aria-hidden
              className="pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("search")}
              aria-label={t("search")}
              className="rounded-lg ps-10"
            />
          </div>
          <div className="max-h-[min(65svh,32rem)] min-h-48 overflow-y-auto p-2">
            {isFetching ? (
              <div className="flex h-36 items-center justify-center">
                <Spinner />
              </div>
            ) : isError ? (
              <p className="px-3 py-10 text-center text-sm text-muted-foreground">
                {t("listLoadFailed")}
              </p>
            ) : !accounts?.length ? (
              <p className="px-3 py-10 text-center text-sm text-muted-foreground">
                {t("noResults")}
              </p>
            ) : (
              <ul className="flex flex-col">
                {accounts.map((account) => (
                  <li
                    key={account.id}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors duration-150 hover:bg-muted/50 motion-reduce:transition-none"
                  >
                    <ProfileHoverCard
                      username={account.username}
                      onClick={() => setOpen(false)}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      <Avatar size="lg">
                        <AvatarImage src={account.profilePicture?.url} alt="" />
                        <AvatarFallback>
                          {account.username.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 text-sm">
                        <span className="block truncate font-semibold">
                          {account.username}
                        </span>
                        <span className="block truncate text-muted-foreground">
                          {getFullName(account.firstName, account.lastName)}
                        </span>
                      </span>
                    </ProfileHoverCard>
                    {isMe && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setConfirm(account)}
                      >
                        {list === "followers"
                          ? t("removeFollower")
                          : t("following")}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!confirm}
        onOpenChange={(next) => !busy && !next && setConfirm(null)}
      >
        <AlertDialogContent size="sm" className="max-w-lg!">
          <AlertDialogHeader>
            <AlertDialogMedia className="size-20 rounded-full bg-transparent">
              <Avatar className="size-20">
                <AvatarImage src={confirm?.profilePicture?.url} alt="" />
                <AvatarFallback className="text-xl">
                  {confirm?.username.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </AlertDialogMedia>
            <AlertDialogTitle>
              {list === "followers"
                ? t("removeFollowerTitle")
                : t("unfollowTitle", { name: confirm?.username ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                list === "followers"
                  ? "removeFollowerBody"
                  : confirm?.visibility === AccountVisibility.PRIVATE
                    ? "unfollowPrivateBody"
                    : "unfollowPublicBody",
                { name: confirm?.username ?? "" },
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              variant="destructive"
              onClick={() => void drop()}
            >
              {busy ? (
                <Spinner />
              ) : list === "followers" ? (
                t("removeFollower")
              ) : (
                t("unfollow")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * Instagram's profile anatomy, centered: avatar (ringed while a story is
 * live), handle, name and bio, counts, then the actions stacked full width.
 */
export default function ProfileHeader({
  profile,
  stories,
}: {
  profile: Profile;
  /** Their live stories; empty when there are none or the viewer can't see them. */
  stories: Story[];
}) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const [storyOpen, setStoryOpen] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [setBlocked, { isLoading: blocking }] = useSetBlockedMutation();
  const isPrivate = profile.visibility === AccountVisibility.PRIVATE;
  const name = getFullName(profile.firstName, profile.lastName);
  const seen = stories.every((s) => s.seen);
  useStoryExpiry(stories);

  const block = async (blocked: boolean) => {
    const result = await setBlocked({ username: profile.username, blocked });
    if ("error" in result) {
      toast.add({
        type: "error",
        description:
          (result.error as ApiError).data?.message ?? t("somethingWrong"),
      });
      return;
    }
    setConfirmBlock(false);
    router.refresh();
  };

  return (
    <>
      <header className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pt-6 md:pt-10">
        <div className="flex items-center gap-6">
          {stories.length ? (
            <Button
              variant="ghost"
              aria-label={t("storyBy", { name: profile.username })}
              onClick={() => setStoryOpen(true)}
              className={cn(
                "h-auto shrink-0 rounded-full hover:bg-transparent",
                storyRing(seen, hasUnseenCloseFriends(stories)),
              )}
            >
              <Avatar className="size-37 ring-4 ring-background">
                <AvatarImage
                  src={profile.profilePicture?.url}
                  alt={t("profilePictureOf", { name: profile.username })}
                />
                <AvatarFallback className="text-2xl">
                  {`${profile.firstName[0]}${profile.lastName[0]}`.toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </Button>
          ) : (
            <Avatar className="size-37 shrink-0">
              <AvatarImage
                src={profile.profilePicture?.url}
                alt={t("profilePictureOf", { name: profile.username })}
              />
              <AvatarFallback className="text-2xl">
                {`${profile.firstName[0]}${profile.lastName[0]}`.toUpperCase()}
              </AvatarFallback>
            </Avatar>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-2.5 items-start">
            <div className="flex min-w-0 items-center gap-1.5 justify-between w-full">
              <h1 className="truncate text-lg font-semibold">
                {profile.username}
              </h1>
              {isPrivate && (
                <Lock
                  aria-label={t("privateAccount")}
                  className="size-4 shrink-0 text-muted-foreground"
                />
              )}
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("moreOptions")}
                      className="ml-auto"
                    />
                  }
                >
                  <MoreH aria-hidden size={20} weight="Filled" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 p-1.5">
                  <DropdownMenuItem
                    onClick={() => void shareProfile(profile.username, t)}
                    className="h-10 gap-3 px-3"
                  >
                    <Share aria-hidden size={20} />
                    {t("shareTo")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => void copyProfileLink(profile.username, t)}
                    className="h-10 gap-3 px-3"
                  >
                    <Link2 aria-hidden size={20} />
                    {t("copyProfileLink")}
                  </DropdownMenuItem>
                  {!profile.isMe && (
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() =>
                        profile.blocked
                          ? void block(false)
                          : setConfirmBlock(true)
                      }
                      className="h-10 gap-3 px-3"
                    >
                      <UserBlock aria-hidden size={20} />
                      {profile.blocked ? t("unblock") : t("block")}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <ul className="flex gap-3 text-start text-[0.8125rem] [&>li>*]:flex [&>li>*]:items-center [&>li>*]:gap-1 [&>li>*]:leading-tight [&>li>*>span:first-child]:text-sm [&>li>*]:text-foreground">
              <li>
                <span>
                  <span className="font-semibold tabular-nums">
                    {compact(profile.counts.posts, lang)}
                  </span>
                  {t(profile.counts.posts === 1 ? "post" : "posts")}
                </span>
              </li>
              <li>
                <FollowCount
                  username={profile.username}
                  list="followers"
                  count={profile.counts.followers}
                  enabled={profile.canView}
                  isMe={profile.isMe}
                />
              </li>
              <li>
                <FollowCount
                  username={profile.username}
                  list="following"
                  count={profile.counts.following}
                  enabled={profile.canView}
                  isMe={profile.isMe}
                />
              </li>
            </ul>
            <div className="flex flex-col gap-0.5 text-sm">
              <p className="font-semibold">{name}</p>
              {profile.followsMe && (
                <span className="self-start rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  {t("followsYou")}
                </span>
              )}
              {profile.bio && (
                <p className="max-w-prose whitespace-pre-line text-pretty">
                  {profile.bio}
                </p>
              )}
              {profile.websites[0] && (
                <span className="flex max-w-full items-center gap-1 self-start">
                  <a
                    href={profile.websites[0]}
                    target="_blank"
                    rel="noopener noreferrer nofollow ugc"
                    dir="ltr"
                    className="flex min-w-0 items-center gap-1 font-semibold text-blue-500 hover:underline"
                  >
                    <Link2 aria-hidden className="size-4 shrink-0" />
                    <span className="truncate">
                      {profile.websites[0]
                        .replace(/^https?:[/][/](www[.])?/, "")
                        .replace(/[/]$/, "")}
                    </span>
                  </a>
                  {profile.websites.length > 1 && (
                    <Dialog>
                      <DialogTrigger
                        render={
                          <Button
                            variant="link"
                            className="h-auto p-0 font-semibold text-blue-500"
                          />
                        }
                      >
                        {t("andMoreLinks", { count: String(profile.websites.length - 1) })}
                      </DialogTrigger>
                      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-sm">
                        <DialogHeader className="h-12 flex-row items-center justify-center border-b px-4">
                          <DialogTitle>{t("links")}</DialogTitle>
                        </DialogHeader>
                        <ul className="flex flex-col p-2">
                          {profile.websites.map((link) => (
                            <li key={link}>
                              <a
                                href={link}
                                target="_blank"
                                rel="noopener noreferrer nofollow ugc"
                                dir="ltr"
                                className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors duration-150 hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none"
                              >
                                <Link2 aria-hidden className="size-5 shrink-0" />
                                <span className="truncate">
                                  {link
                                    .replace(/^https?:[/][/](www[.])?/, "")
                                    .replace(/[/]$/, "")}
                                </span>
                              </a>
                            </li>
                          ))}
                        </ul>
                      </DialogContent>
                    </Dialog>
                  )}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {profile.isMe ? (
            <>
              <Button
                size="lg"
                variant="secondary"
                nativeButton={false}
                render={<Link href="/settings/edit-profile" />}
              >
                {t("editProfile")}
              </Button>
              <Button
                size="lg"
                variant="secondary"
                nativeButton={false}
                render={<Link href="/archive" />}
              >
                {t("viewArchive")}
              </Button>
            </>
          ) : profile.blocked ? (
            <Button
              disabled={blocking}
              onClick={() => void block(false)}
              className="col-span-2"
            >
              {t("unblock")}
            </Button>
          ) : (
            <>
              <FollowButton
                username={profile.username}
                following={profile.following}
                requested={profile.requested}
                followsMe={profile.followsMe}
              />
              <Button
                variant="secondary"
                nativeButton={false}
                render={<Link href="/direct" />}
              >
                {t("message")}
              </Button>
            </>
          )}
        </div>
      </header>

      {storyOpen && (
        <StoryViewer
          reels={[
            {
              user: {
                id: profile.id,
                username: profile.username,
                profilePicture: profile.profilePicture,
              },
              stories,
              seen,
            },
          ]}
          startReel={0}
          onClose={() => setStoryOpen(false)}
        />
      )}

      <AlertDialog
        open={confirmBlock}
        onOpenChange={(open) => !blocking && setConfirmBlock(open)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("blockTitle", { name: profile.username })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t("blockBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={blocking}>
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={blocking}
              variant="destructive"
              onClick={() => void block(true)}
            >
              {blocking ? <Spinner /> : t("block")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
