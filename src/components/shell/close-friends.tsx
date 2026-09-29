"use client";

import { useState } from "react";
import { Search, Star, TickCircle } from "reicon-react";

import { cn, getFullName } from "@/lib/utils";
import { useCloseFriendsQuery, useSetCloseFriendMutation } from "@/store/api";
import { useT } from "../i18n-provider";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Spinner } from "../ui/spinner";
import { toast } from "../ui/toast";

/**
 * Your followers with a circle to tick each one onto close friends. Saves
 * as you tap; filtered by the search box above it.
 */
export function CloseFriendsList({ className }: { className?: string }) {
  const t = useT();
  const [query, setQuery] = useState("");
  const { data, isLoading, isError } = useCloseFriendsQuery();
  const [setCloseFriend] = useSetCloseFriendMutation();
  const q = query.trim().toLowerCase();
  const shown = data?.filter(
    (f) =>
      !q ||
      f.username.includes(q) ||
      getFullName(f.firstName, f.lastName).toLowerCase().includes(q),
  );

  const toggle = async (userId: string, close: boolean) => {
    const result = await setCloseFriend({ userId, close });
    if ("error" in result) toast.add({ type: "error", description: t("somethingWrong") });
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="relative">
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
          className="h-11 rounded-lg ps-10"
        />
      </div>
      {isLoading ? (
        <div className="flex h-36 items-center justify-center">
          <Spinner />
        </div>
      ) : isError ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {t("somethingWrong")}
        </p>
      ) : !data?.length ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {t("noFollowers")}
        </p>
      ) : !shown?.length ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {t("noResults")}
        </p>
      ) : (
        <ul className="flex flex-col">
          {shown.map((friend) => (
            <li key={friend.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={friend.close}
                onClick={() => void toggle(friend.id, !friend.close)}
                className="flex w-full items-center gap-3 rounded-lg px-1 py-2 text-start transition-colors duration-150 hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none"
              >
                <Avatar size="lg">
                  <AvatarImage src={friend.profilePicture?.url} alt="" />
                  <AvatarFallback>
                    {friend.username.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1 text-sm">
                  <span className="block truncate font-semibold">
                    {friend.username}
                  </span>
                  <span className="block truncate text-muted-foreground">
                    {getFullName(friend.firstName, friend.lastName)}
                  </span>
                </span>
                {friend.close ? (
                  <TickCircle
                    aria-hidden
                    weight="Filled"
                    className="size-6 shrink-0 text-green-500"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="size-6 shrink-0 rounded-full border-2 border-muted-foreground/60"
                  />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The last step of a story: everyone, or close friends only (whose list can
 * be edited right here before sharing).
 */
export function StoryAudienceStep({
  sharing,
  onShare,
}: {
  sharing: boolean;
  onShare: (closeFriends: boolean) => void;
}) {
  const t = useT();
  const [editOpen, setEditOpen] = useState(false);
  const { data } = useCloseFriendsQuery();
  const count = data?.filter((f) => f.close).length ?? 0;

  return (
    <div className="flex aspect-square flex-col items-center justify-center gap-4 px-6">
      <p className="text-base font-semibold">{t("shareStoryTo")}</p>
      <div className="flex w-full max-w-xs flex-col gap-2">
        <Button
          size="lg"
          disabled={sharing}
          onClick={() => onShare(false)}
          className="h-12 justify-start gap-3"
        >
          <span className="size-6 shrink-0 rounded-full bg-[conic-gradient(from_180deg,#f9ce34,#ee2a7b,#6228d7,#f9ce34)]" />
          {t("yourStory")} · {t("everyone")}
        </Button>
        {/* No followers means no one to pick: skip the option entirely. */}
        {data?.length ? (
          <>
            <Button
              size="lg"
              variant="secondary"
              disabled={sharing}
              // An empty list would share to no one: pick friends first.
              onClick={() => (count ? onShare(true) : setEditOpen(true))}
              className="h-12 justify-start gap-3"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-green-500 text-white">
                <Star aria-hidden weight="Filled" className="size-3.5" />
              </span>
              {t("closeFriends")}
              <span className="ms-auto text-muted-foreground tabular-nums">{count}</span>
            </Button>
            <Button
              variant="link"
              disabled={sharing}
              onClick={() => setEditOpen(true)}
              className="self-center"
            >
              {t("editList")}
            </Button>
          </>
        ) : null}
      </div>
      {sharing && (
        <p role="status" className="flex items-center gap-2 text-sm">
          <Spinner /> {t("yourStory")}…
        </p>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle>{t("closeFriends")}</DialogTitle>
            <DialogDescription>{t("closeFriendsNote")}</DialogDescription>
          </DialogHeader>
          <CloseFriendsList className="max-h-[min(60svh,28rem)] overflow-y-auto p-4" />
        </DialogContent>
      </Dialog>
    </div>
  );
}
