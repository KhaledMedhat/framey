"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { TickCircle, Users, X } from "reicon-react";

import { cn, getFullName } from "@/lib/utils";
import { MESSAGE_MAX } from "@/lib/validations";
import type { ChatListItem } from "@/server/chat";
import {
  useChatsQuery,
  useFollowListQuery,
  useSearchUsersQuery,
  useSharePostToChatsMutation,
  type AccountPreview,
  type ApiError,
} from "@/store/api";
import { useT } from "../i18n-provider";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Spinner } from "../ui/spinner";
import { toast } from "../ui/toast";

/** A group's name, or its members; a 1:1 chat is the other person. */
export const chatTitle = (chat: Pick<ChatListItem, "isGroup" | "name" | "members">) =>
  chat.isGroup
    ? chat.name || chat.members.map((m) => m.username).join(", ")
    : (chat.members[0]?.username ?? "");

export type Target = {
  key: string;
  userId?: string;
  conversationId?: string;
  label: string;
  sublabel: string;
  picture?: string;
};

/**
 * Search over everyone, with the viewer's recent chats (or, without any,
 * the people they follow) until they type. Rows toggle in and out of `selected`.
 */
export function PeoplePicker({
  selected,
  onToggle,
  withChats,
  className,
}: {
  selected: Target[];
  onToggle: (target: Target) => void;
  /** Offer recent chats (groups included) as targets, as sharing does. */
  withChats?: boolean;
  className?: string;
}) {
  const t = useT();
  const me = useSession().data?.user;
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const { data: results, isFetching } = useSearchUsersQuery(query, { skip: !query });
  const { data: chats } = useChatsQuery("inbox", { skip: !withChats });
  const { data: following } = useFollowListQuery(
    { username: me?.username ?? "", list: "following" },
    { skip: !me?.username || withChats },
  );

  useEffect(() => {
    const timer = setTimeout(() => setQuery(text.trim()), 250);
    return () => clearTimeout(timer);
  }, [text]);

  const fromUser = (u: AccountPreview): Target => ({
    key: `u:${u.id}`,
    userId: u.id,
    label: getFullName(u.firstName, u.lastName) || u.username,
    sublabel: u.username,
    picture: u.profilePicture?.url,
  });
  const rows: Target[] = query
    ? (results ?? []).filter((u) => u.id !== me?.id).map(fromUser)
    : withChats
      ? (chats ?? []).map((chat) =>
          chat.isGroup
            ? {
                key: `c:${chat.id}`,
                conversationId: chat.id,
                label: chatTitle(chat),
                sublabel: t("groupMembers", { count: String(chat.members.length + 1) }),
                picture: chat.members[0]?.profilePicture?.url,
              }
            : fromUser(chat.members[0]!),
        )
      : (following ?? []).map(fromUser);

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="flex flex-wrap items-center gap-1.5 border-b px-4 py-2">
        <span className="text-sm font-semibold">{t("to")}</span>
        {selected.map((target) => (
          <button
            key={target.key}
            type="button"
            onClick={() => onToggle(target)}
            aria-label={t("removeTarget", { name: target.label })}
            className="flex h-7 items-center gap-1 rounded-full bg-muted px-2.5 text-xs font-semibold hover:bg-muted/70"
          >
            {target.label}
            <X aria-hidden className="size-3" />
          </button>
        ))}
        <input
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={t("search")}
          aria-label={t("searchPeople")}
          className="h-8 min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
        {!query && (
          <p className="px-3 pt-1 pb-2 text-sm font-semibold">{t("suggested")}</p>
        )}
        {isFetching && query && !results ? (
          <div className="flex h-24 items-center justify-center">
            <Spinner />
          </div>
        ) : rows.length ? (
          <ul className="flex flex-col">
            {rows.map((row) => {
              const picked = selected.some((s) => s.key === row.key);
              return (
                <li key={row.key}>
                  <button
                    type="button"
                    aria-pressed={picked}
                    onClick={() => onToggle(row)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-start transition-colors duration-150 hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none"
                  >
                    <Avatar size="lg">
                      <AvatarImage src={row.picture} alt="" />
                      <AvatarFallback>
                        {row.conversationId ? (
                          <Users aria-hidden className="size-5" />
                        ) : (
                          row.sublabel.slice(0, 2).toUpperCase()
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex min-w-0 flex-1 flex-col text-sm">
                      <span className="truncate font-semibold">{row.label}</span>
                      <span className="truncate text-muted-foreground">{row.sublabel}</span>
                    </span>
                    <TickCircle
                      aria-hidden
                      weight={picked ? "Filled" : "Outline"}
                      className={cn("size-6 shrink-0", !picked && "text-muted-foreground")}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            {t("noResults")}
          </p>
        )}
      </div>
    </div>
  );
}

/** "Share to…": sends a post or reel, with an optional note, to people and chats. */
export function ShareToDialog({
  postId,
  open,
  onOpenChange,
}: {
  postId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const [selected, setSelected] = useState<Target[]>([]);
  const [note, setNote] = useState("");
  const [share, { isLoading }] = useSharePostToChatsMutation();

  const send = async () => {
    const result = await share({
      postId,
      userIds: selected.flatMap((s) => (s.userId ? [s.userId] : [])),
      conversationIds: selected.flatMap((s) => (s.conversationId ? [s.conversationId] : [])),
      text: note.trim() || undefined,
    });
    if ("error" in result) {
      toast.add({ type: "error", description: (result.error as ApiError).data?.message ?? t("sendFailed") });
      return;
    }
    toast.add({ description: t("sent") });
    setSelected([]);
    setNote("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isLoading && onOpenChange(next)}>
      <DialogContent className="flex h-[min(80svh,36rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="h-12 flex-row items-center justify-center border-b px-4">
          <DialogTitle>{t("share")}</DialogTitle>
        </DialogHeader>
        <PeoplePicker
          withChats
          selected={selected}
          onToggle={(target) =>
            setSelected((list) =>
              list.some((s) => s.key === target.key)
                ? list.filter((s) => s.key !== target.key)
                : list.length >= 20
                  ? list
                  : [...list, target],
            )
          }
          className="flex-1"
        />
        {selected.length > 0 && (
          <DialogFooter className="m-0 flex-col gap-2 border-t p-4 sm:flex-col">
            <Input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={MESSAGE_MAX}
              placeholder={t("writeMessage")}
              aria-label={t("writeMessage")}
            />
            <Button disabled={isLoading} onClick={() => void send()} className="w-full">
              {isLoading ? <Spinner /> : selected.length > 1 ? t("sendSeparately") : t("send")}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
