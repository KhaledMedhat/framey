"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Pusher from "pusher-js";

import { cn, timeAgo } from "@/lib/utils";
import {
  useMarkNotificationReadMutation,
  useMarkNotificationsReadMutation,
  useNotificationsQuery,
  useRespondFollowRequestMutation,
  type ApiError,
  type NotificationItem,
} from "@/store/api";
import type { DictKey } from "@/lib/i18n";
import { useLang, useT } from "../i18n-provider";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Button } from "../ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";
import { Spinner } from "../ui/spinner";
import { toast } from "../ui/toast";

const TEXT: Record<NotificationItem["type"], DictKey> = {
  like: "notifLike",
  comment: "notifComment",
  reply: "notifReply",
  mention: "notifMention",
  follow: "notifFollow",
  follow_request: "notifFollowRequest",
  follow_accept: "notifFollowAccept",
  repost: "notifRepost",
};

// One socket for the tab. Tearing it down on unmount made dev's double-mounted
// effects abort the first handshake mid-connect.
let client: Pusher | null = null;
export const pusherClient = () => {
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
  if (!key || !cluster) return null;
  client ??= new Pusher(key, {
    cluster,
    channelAuthorization: { endpoint: "/api/pusher/auth", transport: "ajax" },
  });
  return client;
};

/**
 * Subscribes to the signed-in user's private Pusher channel; every event
 * refetches the list, so the unread count comes from one place.
 * Returns that count.
 */
export function useNotifications(userId: string) {
  const { data, refetch } = useNotificationsQuery();

  useEffect(() => {
    const pusher = pusherClient();
    if (!pusher || !userId) return;
    const name = `private-user-${userId}`;
    const onNotification = () => void refetch();
    pusher.subscribe(name).bind("notification", onNotification);
    return () => {
      pusher.channel(name)?.unbind("notification", onNotification);
    };
  }, [userId, refetch]);

  return data?.unread ?? 0;
}

/** Everything that happened to you, newest first; follow requests answer inline. */
export function NotificationsSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const t = useT();
  const lang = useLang();
  const { data, isLoading, isError } = useNotificationsQuery();
  const [markAllRead] = useMarkNotificationsReadMutation();
  const [markRead] = useMarkNotificationReadMutation();
  const [respond, { isLoading: responding }] = useRespondFollowRequestMutation();
  const unread = data?.unread ?? 0;

  // Only opening a notification reads it; opening the sheet doesn't.
  const openItem = (n: NotificationItem) => {
    if (!n.read) void markRead(n.id);
    onOpenChange(false);
  };

  const answer = async (n: NotificationItem, accept: boolean) => {
    if (!n.read) void markRead(n.id);
    const result = await respond({ userId: n.actor.id, accept });
    if ("error" in result) {
      toast.add({
        type: "error",
        description:
          (result.error as ApiError).data?.message ?? t("requestAnswerFailed"),
      });
      return;
    }
    router.refresh();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-full gap-0 p-0 sm:max-w-md md:left-18">
        <SheetHeader className="flex-row items-center justify-between border-b px-5 py-4">
          <SheetTitle className="text-xl font-bold">{t("notifications")}</SheetTitle>
          {unread > 0 && (
            <Button
              variant="link"
              size="sm"
              onClick={() => void markAllRead()}
              className="h-auto p-0 me-8"
            >
              {t("markAllRead")}
            </Button>
          )}
          <SheetDescription className="sr-only">
            {t("notificationsDescription")}
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Spinner className="size-5" />
            </div>
          ) : isError ? (
            <p className="px-3 py-16 text-center text-sm text-muted-foreground">
              {t("notificationsLoadFailed")}
            </p>
          ) : !data?.items.length ? (
            <div className="flex flex-col items-center gap-1 px-6 py-16 text-center">
              <p className="text-lg font-semibold">{t("nothingYet")}</p>
              <p className="text-sm text-pretty text-muted-foreground">
                {t("notificationsEmpty")}
              </p>
            </div>
          ) : (
            <ul className="flex flex-col">
              {data.items.map((n) => (
                <li
                  key={n.id}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors duration-150 hover:bg-muted/50 motion-reduce:transition-none",
                    !n.read && "bg-muted/60",
                  )}
                >
                  <Link
                    href={n.postId ? `/p/${n.postId}` : `/${n.actor.username}`}
                    onClick={() => openItem(n)}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <Avatar size="lg">
                      <AvatarImage src={n.actor.profilePicture?.url} alt="" />
                      <AvatarFallback>
                        {n.actor.username.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <p className="min-w-0 flex-1 text-sm leading-snug">
                      <span className="font-semibold">{n.actor.username}</span>{" "}
                      {t(TEXT[n.type])}
                      {n.comment && (
                        <span className="line-clamp-2"> {n.comment}</span>
                      )}{" "}
                      <time
                        dateTime={n.createdAt}
                        className="text-muted-foreground"
                        suppressHydrationWarning
                      >
                        {timeAgo(n.createdAt, lang, t("timeNow"))}
                      </time>
                    </p>
                    {n.type !== "follow_request" && n.thumbnail && (
                      <span className="relative size-11 shrink-0 overflow-hidden rounded-sm bg-muted">
                        <Image src={n.thumbnail} alt="" fill sizes="44px" className="object-cover" />
                      </span>
                    )}
                    {!n.read && (
                      <span aria-label={t("unread")} className="size-2 shrink-0 rounded-full bg-destructive" />
                    )}
                  </Link>
                  {n.type === "follow_request" && (
                    <span className="flex shrink-0 gap-2">
                      <Button
                        size="sm"
                        disabled={responding}
                        onClick={() => void answer(n, true)}
                      >
                        {t("confirm")}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={responding}
                        onClick={() => void answer(n, false)}
                      >
                        {t("delete")}
                      </Button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
