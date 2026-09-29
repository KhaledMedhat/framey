"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useDispatch } from "react-redux";
import {
  ArrowLeft,
  Edit,
  Gallery,
  Heart,
  InfoCircle,
  Messages,
  Microphone,
  Pause,
  Reply,
  Search,
  Trash,
  Users,
  X,
} from "reicon-react";

import {
  isAudioType,
  isImageFile,
  isVideoFile,
  isVideoType,
} from "@/lib/files";
import { cn, getFullName, timeAgo } from "@/lib/utils";
import { MESSAGE_MAX } from "@/lib/validations";
import type { ChatMessage } from "@/server/chat";
import {
  api,
  useChatQuery,
  useChatsQuery,
  useMessagesInfiniteQuery,
  useOpenChatMutation,
  useRemoveChatMutation,
  useSendMessageMutation,
  useSendTypingMutation,
  useSetMessageLikeMutation,
  useUnreadChatsQuery,
  useUnsendMessageMutation,
  useUpdateChatMutation,
  type ApiError,
} from "@/store/api";
import type {
  FeedPost as FeedPostData,
  Gif,
} from "@/interfaces/post.interface";
import { useLang, useT } from "../i18n-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Input } from "../ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Spinner } from "../ui/spinner";
import { Textarea } from "../ui/textarea";
import { toast } from "../ui/toast";
import EmojiButton, { insertEmoji } from "./emoji-button";
import GifPicker from "./gif-picker";
import VoiceMessage, { clock } from "./voice-message";
import FeedPost from "./feed-post";
import { pusherClient } from "./notifications";
import { chatTitle, PeoplePicker, type Target } from "./share-to";

const TYPING_EVERY = 3000;
const TYPING_SHOWN_FOR = 5000;
/** A gap this long between messages gets a timestamp above the later one. */
const TIME_GAP = 60 * 60 * 1000;
const HEART = "❤️";
/** Voice messages stop (and send) at a minute, like Instagram's. */
const VOICE_MAX_SECONDS = 60;
/** Bars in the live recording waveform. */
const RECORD_BARS = 48;

const errorMessage = (error: unknown, fallback: string) =>
  (error as ApiError).data?.message ?? fallback;

/**
 * Refetches whatever a `chat` event on the user's channel says changed, so
 * every open list, thread and badge stays live. Mounted once, in the nav.
 */
export function useChatEvents(userId: string) {
  const dispatch = useDispatch();
  useEffect(() => {
    const pusher = pusherClient();
    if (!pusher || !userId) return;
    const channel = pusher.subscribe(`private-user-${userId}`);
    const onChat = ({ conversationId }: { conversationId: string }) =>
      dispatch(
        api.util.invalidateTags([
          "Chats",
          { type: "Chat", id: conversationId },
          { type: "Messages", id: conversationId },
        ]),
      );
    channel.bind("chat", onChat);
    return () => void channel.unbind("chat", onChat);
  }, [userId, dispatch]);
}

/** Who is typing in `conversationId` right now. */
function useTyping(conversationId: string, userId: string) {
  const [typing, setTyping] = useState<string[]>([]);
  useEffect(() => {
    const pusher = pusherClient();
    if (!pusher || !userId) return;
    const channel = pusher.subscribe(`private-user-${userId}`);
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    const onTyping = (event: { conversationId: string; userId: string }) => {
      if (event.conversationId !== conversationId) return;
      clearTimeout(timers.get(event.userId));
      setTyping((ids) =>
        ids.includes(event.userId) ? ids : [...ids, event.userId],
      );
      timers.set(
        event.userId,
        setTimeout(
          () => setTyping((ids) => ids.filter((id) => id !== event.userId)),
          TYPING_SHOWN_FOR,
        ),
      );
    };
    channel.bind("typing", onTyping);
    return () => {
      channel.unbind("typing", onTyping);
      timers.forEach(clearTimeout);
      setTyping([]);
    };
  }, [conversationId, userId]);
  return typing;
}

/**
 * The inbox: search, Messages / Requests, then one row per chat. Rows link to
 * `/direct/<id>`, or call `onSelect` when the list lives in a popover.
 */
export function ChatList({
  onSelect,
  className,
}: {
  onSelect?: (id: string) => void;
  className?: string;
}) {
  const t = useT();
  const lang = useLang();
  const pathname = usePathname();
  const router = useRouter();
  const me = useSession().data?.user;
  const [folder, setFolder] = useState<"inbox" | "requests">("inbox");
  const [query, setQuery] = useState("");
  const [composing, setComposing] = useState(false);
  const { data, isLoading, isError } = useChatsQuery(folder);
  const { data: unread } = useUnreadChatsQuery();
  const q = query.trim().toLowerCase();
  const chats = data?.filter(
    (chat) =>
      !q ||
      chatTitle(chat).toLowerCase().includes(q) ||
      chat.members.some((m) =>
        getFullName(m.firstName, m.lastName).toLowerCase().includes(q),
      ),
  );
  const open = (id: string) =>
    onSelect ? onSelect(id) : router.push(`/direct/${id}`);

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="flex items-center justify-between gap-2 px-4 pt-5 pb-3">
        <h1 className="truncate text-xl font-bold">
          {me?.username ?? t("messages")}
        </h1>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("newMessage")}
          onClick={() => setComposing(true)}
        >
          <Edit aria-hidden className="size-6" />
        </Button>
      </div>
      <div className="relative mx-4">
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
      <div role="tablist" className="mt-3 flex border-b px-4">
        {(["inbox", "requests"] as const).map((f) => {
          const count = unread?.[f] ?? 0;
          return (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={folder === f}
              onClick={() => setFolder(f)}
              className={cn(
                "-mb-px flex h-11 flex-1 items-center justify-center gap-1.5 border-b text-sm font-semibold text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none",
                folder === f && "border-foreground text-foreground",
              )}
            >
              {f === "inbox" ? t("messages") : t("chatRequests")}
              {count > 0 && (
                <span className="flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-destructive px-1 text-[0.6875rem] leading-none text-white tabular-nums">
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
        {isLoading ? (
          <div className="flex h-36 items-center justify-center">
            <Spinner />
          </div>
        ) : isError ? (
          <p className="px-3 py-10 text-center text-sm text-muted-foreground">
            {t("listLoadFailed")}
          </p>
        ) : !chats?.length ? (
          <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <p className="text-sm font-semibold">
              {q
                ? t("noResults")
                : folder === "inbox"
                  ? t("noChats")
                  : t("noRequests")}
            </p>
            {!q && folder === "inbox" && (
              <Button
                size="sm"
                onClick={() => setComposing(true)}
                className="mt-2"
              >
                {t("sendMessage")}
              </Button>
            )}
          </div>
        ) : (
          <ul className="flex flex-col">
            {chats.map((chat) => {
              const active = pathname === `/direct/${chat.id}`;
              const last = chat.lastMessage;
              const preview = !last
                ? t("tapToChat")
                : last.kind === "post"
                  ? t("sharedPost")
                  : last.kind === "story"
                    ? t("repliedToStory")
                    : last.kind === "voice"
                      ? t("sentVoiceMessage")
                      : last.kind === "media"
                        ? t("sentAttachment")
                        : (last.text ?? "");
              return (
                <li key={chat.id}>
                  <button
                    type="button"
                    onClick={() => open(chat.id)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-start transition-colors duration-150 hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none",
                      active && "bg-muted",
                    )}
                  >
                    {chat.isGroup ? (
                      <span className="relative size-14 shrink-0">
                        <Avatar className="absolute top-0 start-0 size-10">
                          <AvatarImage
                            src={chat.members[0]?.profilePicture?.url}
                            alt=""
                          />
                          <AvatarFallback>
                            {chat.members[0]?.username
                              .slice(0, 2)
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <Avatar className="absolute end-0 bottom-0 size-10 ring-2 ring-background">
                          <AvatarImage
                            src={chat.members[1]?.profilePicture?.url}
                            alt=""
                          />
                          <AvatarFallback>
                            {chat.members[1]?.username
                              .slice(0, 2)
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </span>
                    ) : (
                      <Avatar className="size-14">
                        <AvatarImage
                          src={chat.members[0]?.profilePicture?.url}
                          alt=""
                        />
                        <AvatarFallback>
                          {chat.members[0]?.username.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <span className="flex min-w-0 flex-1 flex-col text-sm">
                      <span
                        className={cn(
                          "truncate",
                          chat.unread && "font-semibold",
                        )}
                      >
                        {chat.isGroup
                          ? chatTitle(chat)
                          : getFullName(
                              chat.members[0]?.firstName ?? "",
                              chat.members[0]?.lastName ?? "",
                            ) || chatTitle(chat)}
                      </span>
                      <span
                        className={cn(
                          "flex min-w-0 gap-1 text-muted-foreground",
                          chat.unread && "font-semibold text-foreground",
                        )}
                      >
                        <span className="truncate">
                          {last && last.senderId === me?.id
                            ? t("youPrefix", { text: preview })
                            : preview}
                        </span>
                        {last && (
                          <span className="shrink-0">
                            · {timeAgo(last.createdAt, lang, t("timeNow"))}
                          </span>
                        )}
                      </span>
                    </span>
                    {chat.unread && (
                      <span
                        aria-label={t("unread")}
                        className="size-2 shrink-0 rounded-full bg-foreground"
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <NewChatDialog
        open={composing}
        onOpenChange={setComposing}
        onOpened={(id) => {
          setComposing(false);
          open(id);
        }}
      />
    </div>
  );
}

/** Pick one person for a 1:1 chat, or several (and a name) for a group. */
function NewChatDialog({
  open,
  onOpenChange,
  onOpened,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpened: (id: string) => void;
}) {
  const t = useT();
  const [selected, setSelected] = useState<Target[]>([]);
  const [name, setName] = useState("");
  const [openChat, { isLoading }] = useOpenChatMutation();

  const start = async () => {
    const result = await openChat({
      userIds: selected.map((s) => s.userId!),
      name: selected.length > 1 ? name : undefined,
    });
    if ("error" in result) {
      toast.add({
        type: "error",
        description: errorMessage(result.error, t("somethingWrong")),
      });
      return;
    }
    setSelected([]);
    setName("");
    onOpened(result.data.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(80svh,36rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="h-12 flex-row items-center justify-center border-b px-4">
          <DialogTitle>{t("newMessage")}</DialogTitle>
        </DialogHeader>
        <PeoplePicker
          selected={selected}
          onToggle={(target) =>
            setSelected((list) =>
              list.some((s) => s.key === target.key)
                ? list.filter((s) => s.key !== target.key)
                : [...list, target],
            )
          }
          className="flex-1"
        />
        <DialogFooter className="m-0 flex-col gap-2 border-t p-4 sm:flex-col">
          {selected.length > 1 && (
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={100}
              placeholder={t("groupNamePlaceholder")}
              aria-label={t("groupNamePlaceholder")}
            />
          )}
          <Button
            disabled={!selected.length || isLoading}
            onClick={() => void start()}
            className="w-full"
          >
            {isLoading ? <Spinner /> : t("chat")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * One conversation: header, messages (newest at the bottom, older ones load
 * as you scroll up) and the composer. A request shows Accept / Delete in
 * place of the composer until it's answered.
 */
export function ChatThread({
  id,
  onBack,
  compact,
}: {
  id: string;
  /** Popover: back to the list. Without it, a phone's back goes to /direct. */
  onBack?: () => void;
  compact?: boolean;
}) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const me = useSession().data?.user;
  const myId = me?.id ?? "";
  const { data: chat, isError: chatError } = useChatQuery(id);
  const {
    data,
    isLoading,
    isError,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useMessagesInfiniteQuery(id);
  const [updateChat] = useUpdateChatMutation();
  const [removeChat, { isLoading: removing }] = useRemoveChatMutation();
  const [setLike] = useSetMessageLikeMutation();
  const [unsend] = useUnsendMessageMutation();
  const [confirmRemove, setConfirmRemove] = useState(false);
  // Replying to (shown over the composer) and removing (confirmed first).
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [toRemove, setToRemove] = useState<ChatMessage | null>(null);
  const [openPost, setOpenPost] = useState<FeedPostData | null>(null);
  const typing = useTyping(id, myId);
  const older = useRef<HTMLDivElement>(null);
  const markedFor = useRef<string | null>(null);

  const list = data?.pages.flatMap((p) => p.messages) ?? [];
  const newest = list[0];

  // Seen: once the newest message from someone else is on screen.
  useEffect(() => {
    if (!chat?.accepted || !newest || newest.senderId === myId) return;
    if (markedFor.current === newest.id || document.hidden) return;
    markedFor.current = newest.id;
    void updateChat({ id, action: "read" });
  }, [chat?.accepted, newest, myId, id, updateChat]);

  // Older pages load when the top of the list scrolls into view.
  useEffect(() => {
    const node = older.current;
    if (!node || !hasNextPage) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting && !isFetchingNextPage) void fetchNextPage();
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const back = () => (onBack ? onBack() : router.push("/direct"));
  const toggleLike = async (message: ChatMessage) => {
    const result = await setLike({
      id: message.id,
      conversationId: id,
      liked: !message.likes.includes(myId),
      userId: myId,
    });
    if ("error" in result)
      toast.add({ type: "error", description: t("somethingWrong") });
  };
  const remove = async () => {
    const result = await removeChat(id);
    if ("error" in result) {
      toast.add({
        type: "error",
        description: errorMessage(result.error, t("somethingWrong")),
      });
      return;
    }
    setConfirmRemove(false);
    back();
  };

  if (chatError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-muted-foreground">{t("chatNotFound")}</p>
        <Button variant="secondary" size="sm" onClick={back}>
          {t("back")}
        </Button>
      </div>
    );
  }

  const other = chat && !chat.isGroup ? chat.members[0] : undefined;
  const title = chat ? chatTitle(chat) : "";
  // "Seen" sits under your newest message once someone has read past it.
  const myNewest = list.find((m) => m.senderId === myId);
  const seenBy = myNewest
    ? (chat?.members.filter((m) => m.lastReadAt >= myNewest.createdAt) ?? [])
    : [];
  const typingNames = chat?.members
    .filter((m) => typing.includes(m.id))
    .map((m) => m.username);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b px-3">
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("back")}
          onClick={back}
          className={cn(!onBack && "md:hidden")}
        >
          <ArrowLeft aria-hidden className="size-6 rtl:rotate-180" />
        </Button>
        {chat && (
          <Link
            href={other ? `/${other.username}` : "#"}
            onClick={(event) => !other && event.preventDefault()}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <Avatar size="lg">
              <AvatarImage src={chat.members[0]?.profilePicture?.url} alt="" />
              <AvatarFallback>
                {chat.isGroup ? (
                  <Users aria-hidden className="size-5" />
                ) : (
                  title.slice(0, 2).toUpperCase()
                )}
              </AvatarFallback>
            </Avatar>
            <span className="flex min-w-0 flex-col text-sm">
              <span className="truncate font-semibold">
                {other
                  ? getFullName(other.firstName, other.lastName) || title
                  : title}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {other
                  ? other.username
                  : t("groupMembers", {
                      count: String(chat.members.length + 1),
                    })}
              </span>
            </span>
          </Link>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("chatDetails")}
                className="ms-auto"
              />
            }
          >
            <InfoCircle aria-hidden className="size-6" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 p-1.5">
            {other && (
              <DropdownMenuItem
                className="h-10 px-3"
                render={<Link href={`/${other.username}`} />}
              >
                {t("viewProfile")}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setConfirmRemove(true)}
              className="h-10 px-3"
            >
              {chat?.isGroup ? t("leaveGroup") : t("deleteChat")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Reversed column: it opens scrolled to the newest message. */}
      <div className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto overscroll-contain px-3 py-4">
        {typingNames && typingNames.length > 0 && (
          <p
            className="px-12 pt-2 text-xs text-muted-foreground"
            aria-live="polite"
          >
            {t("typing", { name: typingNames.join(", ") })}
          </p>
        )}
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <Spinner />
          </div>
        ) : isError ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {t("listLoadFailed")}
          </p>
        ) : (
          list.map((message, i) => {
            const mine = message.senderId === myId;
            const newer = list[i - 1];
            const olderMessage = list[i + 1];
            const lastInRun = !newer || newer.senderId !== message.senderId;
            const gap =
              !olderMessage ||
              Date.parse(message.createdAt) -
                Date.parse(olderMessage.createdAt) >
                TIME_GAP;
            const firstInRun =
              gap || olderMessage?.senderId !== message.senderId;
            const liked = message.likes.includes(myId);
            const video = isVideoType(message.media?.type);
            return (
              <div key={message.id} className="flex flex-col">
                {gap && (
                  <p className="py-3 text-center text-xs text-muted-foreground">
                    {new Date(message.createdAt).toLocaleString(lang, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                )}
                {chat?.isGroup && !mine && firstInRun && (
                  <p className="ms-12 mb-0.5 text-xs text-muted-foreground">
                    {message.sender.username}
                  </p>
                )}
                <div
                  className={cn(
                    "group flex items-end gap-2",
                    mine ? "flex-row-reverse" : "flex-row",
                    lastInRun ? "mb-2" : "mb-0.5",
                    message.pending && "pointer-events-none opacity-60",
                  )}
                >
                  {!mine &&
                    (lastInRun ? (
                      <Link
                        href={`/${message.sender.username}`}
                        className="shrink-0 rounded-full"
                      >
                        <Avatar>
                          <AvatarImage
                            src={message.sender.profilePicture?.url}
                            alt=""
                          />
                          <AvatarFallback>
                            {message.sender.username.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </Link>
                    ) : (
                      <span className="w-8 shrink-0" />
                    ))}
                  <div
                    className={cn(
                      "relative flex max-w-[75%] flex-col outline-none",
                      mine ? "items-end" : "items-start",
                      message.likes.length > 0 && "mb-4",
                    )}
                    // Touch has no hover: tapping the bubble focuses it, which
                    // reveals its like/reply/remove actions.
                    tabIndex={-1}
                    onDoubleClick={() => void toggleLike(message)}
                  >
                    {message.replyTo && (
                      <div className={cn("mb-0.5 flex max-w-full flex-col gap-0.5", mine ? "items-end" : "items-start")}>
                        <p className="text-xs text-muted-foreground">
                          {mine
                            ? message.replyTo.senderId === myId
                              ? t("youRepliedToYourself")
                              : t("youRepliedTo", { name: message.replyTo.username })
                            : message.replyTo.senderId === myId
                              ? t("repliedToYou", { name: message.sender.username })
                              : t("repliedTo", {
                                  name: message.sender.username,
                                  target: message.replyTo.username,
                                })}
                        </p>
                        <p
                          dir="auto"
                          className="line-clamp-2 max-w-full rounded-2xl border px-3 py-1.5 text-xs break-words text-muted-foreground"
                        >
                          {message.replyTo.text ??
                            t(
                              message.replyTo.kind === "post"
                                ? "sharedPost"
                                : message.replyTo.kind === "voice"
                                  ? "voiceMessage"
                                  : "sentAttachment",
                            )}
                        </p>
                      </div>
                    )}
                    {message.story && (
                      <div
                        className={cn(
                          "mb-1 flex flex-col gap-1",
                          mine ? "items-end" : "items-start",
                        )}
                      >
                        <p className="text-xs text-muted-foreground">
                          {mine
                            ? t("youRepliedToStory")
                            : t("repliedToYourStory")}
                        </p>
                        {message.story.thumb ? (
                          <span className="relative block aspect-9/16 w-24 overflow-hidden rounded-xl bg-muted">
                            <Image
                              src={message.story.thumb}
                              alt=""
                              fill
                              sizes="96px"
                              className="object-cover"
                            />
                          </span>
                        ) : (
                          <p className="rounded-xl border px-3 py-2 text-xs text-muted-foreground">
                            {t("storyUnavailable")}
                          </p>
                        )}
                      </div>
                    )}
                    {message.shared ? (
                      message.post ? (
                        <button
                          type="button"
                          onClick={() =>
                            isVideoType(message.post!.media[0]?.type)
                              ? router.push(`/reels/${message.post!.id}`)
                              : setOpenPost(message.post)
                          }
                          className="w-56 overflow-hidden rounded-2xl bg-muted text-start focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                        >
                          <span className="flex items-center gap-2 px-3 py-2">
                            <Avatar size="sm">
                              <AvatarImage
                                src={message.post.author.profilePicture?.url}
                                alt=""
                              />
                              <AvatarFallback>
                                {message.post.author.username
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="truncate text-sm font-semibold">
                              {message.post.author.username}
                            </span>
                          </span>
                          <span className="relative block aspect-4/5 bg-background">
                            {(isVideoType(message.post.media[0]?.type)
                              ? message.post.media[0]?.cover?.url
                              : message.post.media[0]?.url) && (
                              <Image
                                src={
                                  (isVideoType(message.post.media[0]?.type)
                                    ? message.post.media[0]?.cover?.url
                                    : message.post.media[0]?.url)!
                                }
                                alt={message.post.media[0]?.alt ?? ""}
                                fill
                                sizes="224px"
                                className="object-cover"
                              />
                            )}
                          </span>
                          {message.post.caption && (
                            <span className="line-clamp-2 px-3 py-2 text-sm">
                              <span className="font-semibold">
                                {message.post.author.username}
                              </span>{" "}
                              {message.post.caption}
                            </span>
                          )}
                        </button>
                      ) : (
                        <div className="w-56 rounded-2xl border px-4 py-3 text-sm">
                          <p className="font-semibold">
                            {t("postUnavailable")}
                          </p>
                          <p className="text-muted-foreground">
                            {t("postUnavailableBody")}
                          </p>
                        </div>
                      )
                    ) : message.media && isAudioType(message.media.type) ? (
                      <VoiceMessage url={message.media.url} mine={mine} />
                    ) : message.media ? (
                      video ? (
                        <video
                          src={message.media.url}
                          controls
                          playsInline
                          preload="metadata"
                          className="max-h-80 w-60 rounded-2xl bg-muted"
                        />
                      ) : (
                        <Image
                          src={message.media.url}
                          alt=""
                          width={message.media.width ?? 480}
                          height={message.media.height ?? 480}
                          // Local previews and GIFs (animated webp) skip the optimiser.
                          unoptimized={
                            message.media.url.startsWith("blob:") ||
                            message.media.type === "image/gif"
                          }
                          sizes="240px"
                          className="max-h-80 w-60 rounded-2xl object-cover"
                        />
                      )
                    ) : message.text === HEART ? (
                      <span
                        className="text-5xl leading-none"
                        role="img"
                        aria-label={t("heart")}
                      >
                        {HEART}
                      </span>
                    ) : (
                      <p
                        dir="auto"
                        className={cn(
                          "rounded-3xl px-3.5 py-2 text-sm break-words whitespace-pre-wrap",
                          mine
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted",
                        )}
                      >
                        {message.text}
                      </p>
                    )}
                    {message.likes.length > 0 && (
                      <span
                        className={cn(
                          "absolute -bottom-4 flex h-6 items-center gap-0.5 rounded-full border bg-background px-1.5 text-xs tabular-nums",
                          mine ? "end-2" : "start-2",
                        )}
                      >
                        {HEART}
                        {message.likes.length > 1 && message.likes.length}
                      </span>
                    )}
                  </div>
                  <div className="flex shrink-0 opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:pointer-events-none pointer-coarse:group-focus-within:pointer-events-auto motion-reduce:transition-none">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={liked ? t("unlikeMessage") : t("likeMessage")}
                      onClick={() => void toggleLike(message)}
                    >
                      <Heart
                        aria-hidden
                        weight={liked ? "Filled" : "Outline"}
                        className="size-4"
                      />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("reply")}
                      onClick={() => setReplyTo(message)}
                    >
                      <Reply aria-hidden className="size-4 rtl:-scale-x-100" />
                    </Button>
                    {mine && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("removeMessage")}
                        onClick={() => setToRemove(message)}
                        className="hover:text-destructive"
                      >
                        <Trash aria-hidden className="size-4" />
                      </Button>
                    )}
                    <span className="self-center px-1 text-xs text-muted-foreground">
                      {new Date(message.createdAt).toLocaleTimeString(lang, {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
                {message.id === myNewest?.id &&
                  i === 0 &&
                  seenBy.length > 0 && (
                    <p className="mb-1 text-end text-xs text-muted-foreground">
                      {chat?.isGroup
                        ? t("seenBy", { count: String(seenBy.length) })
                        : t("seen")}
                    </p>
                  )}
              </div>
            );
          })
        )}
        <div ref={older} className="flex min-h-1 justify-center">
          {isFetchingNextPage && <Spinner />}
        </div>
        {chat && !hasNextPage && !isLoading && (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Avatar className="size-24">
              <AvatarImage src={chat.members[0]?.profilePicture?.url} alt="" />
              <AvatarFallback className="text-2xl">
                {chat.isGroup ? (
                  <Users aria-hidden className="size-10" />
                ) : (
                  title.slice(0, 2).toUpperCase()
                )}
              </AvatarFallback>
            </Avatar>
            <p className="text-lg font-semibold">
              {other
                ? getFullName(other.firstName, other.lastName) || title
                : title}
            </p>
            {other && (
              <Button
                variant="secondary"
                size="sm"
                nativeButton={false}
                render={<Link href={`/${other.username}`} />}
              >
                {t("viewProfile")}
              </Button>
            )}
          </div>
        )}
      </div>

      {!chat ? null : chat.blocked ? (
        <p className="border-t px-4 py-4 text-center text-sm text-muted-foreground">
          {t("cantMessage")}
        </p>
      ) : !chat.accepted ? (
        <div className="flex flex-col gap-3 border-t px-4 py-4 text-center">
          <p className="text-sm font-semibold">
            {t("requestTitle", { name: title })}
          </p>
          <p className="text-xs text-muted-foreground">{t("requestBody")}</p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              disabled={removing}
              onClick={() => setConfirmRemove(true)}
            >
              {t("delete")}
            </Button>
            <Button
              onClick={() =>
                void updateChat({ id, action: "accept" }).then((result) => {
                  if ("error" in result) {
                    toast.add({
                      type: "error",
                      description: t("somethingWrong"),
                    });
                  } else {
                    void updateChat({ id, action: "read" });
                  }
                })
              }
            >
              {t("acceptRequest")}
            </Button>
          </div>
        </div>
      ) : (
        <Composer
          conversationId={id}
          compact={compact}
          replyTo={replyTo}
          onClearReply={() => setReplyTo(null)}
        />
      )}

      <Dialog
        open={openPost !== null}
        onOpenChange={(next) => !next && setOpenPost(null)}
      >
        <DialogContent className="inset-0 top-0 left-0 h-svh w-full max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-none bg-background px-0 py-12 sm:max-w-none md:grid md:place-items-center md:px-16">
          {openPost && (
            <>
              <DialogTitle className="sr-only">
                {t("postBy", { name: openPost.author.username })}
              </DialogTitle>
              <FeedPost
                key={openPost.id}
                post={openPost}
                priority
                layout="modal"
              />
              <DialogClose
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="fixed end-3 top-3 md:end-4 md:top-4"
                  />
                }
              >
                <X aria-hidden />
                <span className="sr-only">{t("close")}</span>
              </DialogClose>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={toRemove !== null} onOpenChange={(next) => !next && setToRemove(null)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("removeMessageTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("removeMessageBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                const message = toRemove;
                setToRemove(null);
                if (!message) return;
                if (replyTo?.id === message.id) setReplyTo(null);
                void unsend({ id: message.id, conversationId: id }).then(
                  (result) =>
                    "error" in result &&
                    toast.add({ type: "error", description: t("somethingWrong") }),
                );
              }}
            >
              {t("remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmRemove}
        onOpenChange={(next) => !removing && setConfirmRemove(next)}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {chat?.isGroup ? t("leaveGroupTitle") : t("deleteChatTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {chat?.isGroup ? t("leaveGroupBody") : t("deleteChatBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={removing}
              onClick={() => void remove()}
            >
              {removing ? (
                <Spinner />
              ) : chat?.isGroup ? (
                t("leaveGroup")
              ) : (
                t("delete")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Text with emoji, a photo or video, or a quick heart; Enter sends. */
function Composer({
  conversationId,
  compact,
  replyTo,
  onClearReply,
}: {
  conversationId: string;
  compact?: boolean;
  replyTo: ChatMessage | null;
  onClearReply: () => void;
}) {
  const t = useT();
  const [text, setText] = useState("");
  const field = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const lastTyping = useRef(0);
  useEffect(() => {
    if (replyTo) field.current?.focus();
  }, [replyTo]);
  const me = useSession().data?.user;
  const [send] = useSendMessageMutation();
  const [sendTyping] = useSendTypingMutation();
  // Voice: seconds recorded so far while the mic is on, null otherwise;
  // `levels` is the live waveform, newest last.
  const [recording, setRecording] = useState<number | null>(null);
  const [recordPaused, setRecordPaused] = useState(false);
  const [levels, setLevels] = useState<number[]>([]);
  const recorder = useRef<MediaRecorder | null>(null);
  const keepRecording = useRef(true);
  const meter = useRef<{
    context: AudioContext;
    analyser: AnalyserNode;
  } | null>(null);

  // A dropped composer (chat closed mid-recording) mustn't leave the mic on.
  useEffect(
    () => () => {
      keepRecording.current = false;
      recorder.current?.stop();
    },
    [],
  );

  // The clock and the live waveform run only while actually recording.
  const live = recording !== null && !recordPaused;
  useEffect(() => {
    if (!live) return;
    const clockTimer = setInterval(() => {
      setRecording((s) => (s === null ? s : s + 1));
    }, 1000);
    const samples = new Uint8Array(1024);
    const meterTimer = setInterval(() => {
      const analyser = meter.current?.analyser;
      if (!analyser) return;
      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (const v of samples) sum += ((v - 128) / 128) ** 2;
      const level = Math.min(1, Math.sqrt(sum / samples.length) * 4);
      setLevels((l) => [...l.slice(-(RECORD_BARS - 1)), Math.max(0.08, level)]);
    }, 90);
    return () => {
      clearInterval(clockTimer);
      clearInterval(meterTimer);
    };
  }, [live]);

  // Long enough: stop and send it, like Instagram's one-minute cap.
  useEffect(() => {
    if (recording !== null && recording >= VOICE_MAX_SECONDS)
      recorder.current?.stop();
  }, [recording]);

  const startRecording = async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast.add({ type: "error", description: t("micBlocked") });
      return;
    }
    // Chrome and Firefox record webm/opus; Safari only mp4.
    const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find(
      (type) => MediaRecorder.isTypeSupported(type),
    );
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    context.createMediaStreamSource(stream).connect(analyser);
    meter.current = { context, analyser };
    rec.ondataavailable = (event) => event.data.size && chunks.push(event.data);
    rec.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      void meter.current?.context.close();
      meter.current = null;
      recorder.current = null;
      setRecording(null);
      setRecordPaused(false);
      setLevels([]);
      if (!keepRecording.current || !chunks.length) return;
      const type = (rec.mimeType || "audio/webm").split(";")[0]!;
      const file = new File(
        chunks,
        `voice.${type === "audio/mp4" ? "m4a" : "webm"}`,
        { type },
      );
      void submit({ file });
    };
    keepRecording.current = true;
    recorder.current = rec;
    rec.start();
    setRecording(0);
  };
  const stopRecording = (keep: boolean) => {
    keepRecording.current = keep;
    recorder.current?.stop();
  };
  const togglePause = () => {
    const rec = recorder.current;
    if (!rec) return;
    if (rec.state === "recording") {
      rec.pause();
      setRecordPaused(true);
    } else if (rec.state === "paused") {
      rec.resume();
      setRecordPaused(false);
    }
  };

  // Each message shows at once (see the mutation); sending never blocks the field.
  const submit = async (payload: { text?: string; file?: File; gif?: Gif }) => {
    if (!me) return false;
    const quoting = replyTo;
    onClearReply();
    const result = await send({
      conversationId,
      ...payload,
      replyTo: quoting
        ? {
            id: quoting.id,
            senderId: quoting.senderId,
            username: quoting.sender.username,
            text: quoting.text,
            kind: quoting.shared
              ? "post"
              : isAudioType(quoting.media?.type)
                ? "voice"
                : quoting.media
                  ? "media"
                  : "text",
          }
        : undefined,
      sender: {
        id: me.id,
        username: me.username,
        firstName: me.firstName,
        lastName: me.lastName,
        profilePicture: me.profilePicture,
      },
    });
    if ("error" in result) {
      toast.add({
        type: "error",
        description: errorMessage(result.error, t("sendFailed")),
      });
      return false;
    }
    return true;
  };
  const sendText = async () => {
    const value = text.trim();
    if (!value) return;
    setText("");
    if (!(await submit({ text: value }))) setText(value);
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void sendText();
      }}
      className={cn("shrink-0 px-3 pt-2", compact ? "pb-3" : "pb-4")}
    >
      {replyTo && (
        <div className="mb-2 flex items-center gap-2 border-s-2 border-foreground/40 ps-3">
          <div className="min-w-0 flex-1 text-xs">
            <p className="font-semibold">
              {replyTo.senderId === me?.id
                ? t("replyingToYourself")
                : t("replyingTo", { name: replyTo.sender.username })}
            </p>
            <p dir="auto" className="truncate text-muted-foreground">
              {replyTo.text ??
                t(
                  replyTo.shared
                    ? "sharedPost"
                    : isAudioType(replyTo.media?.type)
                      ? "voiceMessage"
                      : "sentAttachment",
                )}
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon-xs" aria-label={t("cancelReply")} onClick={onClearReply}>
            <X aria-hidden />
          </Button>
        </div>
      )}
      {recording !== null ? (
        <div className="flex min-h-11 items-center gap-2 rounded-3xl border px-2 py-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("discardRecording")}
            onClick={() => stopRecording(false)}
            className="text-destructive hover:text-destructive"
          >
            <Trash aria-hidden className="size-5" />
          </Button>
          <span
            aria-hidden
            className={cn(
              "size-2.5 shrink-0 rounded-full bg-destructive",
              recordPaused
                ? "opacity-40"
                : "animate-pulse motion-reduce:animate-none",
            )}
          />
          {/* The live waveform: the newest sound on the right, scrolling left. */}
          <div
            aria-hidden
            className="flex h-8 min-w-0 flex-1 items-center justify-end gap-[2px] overflow-hidden"
          >
            {levels.map((level, i) => (
              <span
                key={i}
                style={{ height: `${Math.round(level * 100)}%` }}
                className={cn(
                  "min-h-[3px] w-[3px] shrink-0 rounded-full",
                  recordPaused ? "bg-muted-foreground" : "bg-foreground",
                )}
              />
            ))}
          </div>
          <span
            role="timer"
            aria-label={t("recording")}
            className="shrink-0 text-sm tabular-nums"
          >
            {clock(recording)}
            <span className="text-muted-foreground">
              {" "}
              / {clock(VOICE_MAX_SECONDS)}
            </span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={
              recordPaused ? t("resumeRecording") : t("pauseRecording")
            }
            onClick={togglePause}
          >
            {recordPaused ? (
              <Microphone aria-hidden className="size-5" />
            ) : (
              <Pause aria-hidden weight="Filled" className="size-5" />
            )}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => stopRecording(true)}
            className="rounded-full"
          >
            {t("send")}
          </Button>
        </div>
      ) : (
        <div className="flex min-h-11 items-end gap-1 rounded-3xl border px-2 py-1">
          <GifPicker
            onPick={(gif) => void submit({ gif })}
            className="mb-0.5"
          />
          <EmojiButton
            onEmoji={(emoji) => {
              const next = insertEmoji(field.current, text, emoji);
              setText(next.value);
              requestAnimationFrame(() => {
                field.current?.focus();
                field.current?.setSelectionRange(next.caret, next.caret);
              });
            }}
            className="mb-0.5"
          />
          <Textarea
            ref={field}
            rows={1}
            value={text}
            maxLength={MESSAGE_MAX}
            onChange={(event) => {
              setText(event.target.value);
              if (Date.now() - lastTyping.current > TYPING_EVERY) {
                lastTyping.current = Date.now();
                void sendTyping(conversationId);
              }
            }}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                void sendText();
              }
            }}
            placeholder={t("messagePlaceholder")}
            aria-label={t("messagePlaceholder")}
            className="max-h-32 min-h-9 flex-1 resize-none border-0 bg-transparent px-1 py-2 shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
          {text.trim() ? (
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="mb-0.5 font-semibold"
            >
              {t("send")}
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t("recordVoice")}
                onClick={() => void startRecording()}
                className="mb-0.5"
              >
                <Microphone aria-hidden className="size-5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t("attachMedia")}
                onClick={() => picker.current?.click()}
                className="mb-0.5"
              >
                <Gallery aria-hidden className="size-5" />
              </Button>
            </>
          )}
          <input
            ref={picker}
            type="file"
            accept="image/*,video/*"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              if (!isImageFile(file) && !isVideoFile(file)) {
                toast.add({
                  type: "error",
                  description: t("photoOrVideoOnly"),
                });
                return;
              }
              void submit({ file });
            }}
          />
        </div>
      )}
    </form>
  );
}

/**
 * The feed's way into messages: "Messages", the avatars of people with unread
 * messages and how many they are. `pill` sits at the bottom of the feed's
 * rail; `fab` floats in the bottom corner when the rail is hidden (a round
 * icon linking to /direct on a phone). Both open the inbox in a popover.
 */
export function ChatLauncher({ variant }: { variant: "pill" | "fab" }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const { data: unread } = useUnreadChatsQuery();
  const count = unread?.inbox ?? 0;
  // Whoever is waiting on you, newest first.
  const faces = unread?.senders ?? [];
  const label = count ? `${t("messages")}, ${count}` : t("messages");

  return (
    <>
      {variant === "fab" && (
        <Link
          href="/direct"
          aria-label={label}
          className="fixed end-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none md:hidden"
        >
          <Messages aria-hidden className="size-6" />
          {count > 0 && (
            <span className="absolute -top-0.5 -end-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-xs font-semibold text-white tabular-nums ring-2 ring-background">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Link>
      )}
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setActive(null);
        }}
      >
        <PopoverTrigger
          render={
            variant === "pill" ? (
              <Button
                variant="secondary"
                aria-label={label}
                className="relative h-14 w-full justify-start gap-3 rounded-full px-5"
              />
            ) : (
              <Button
                variant="secondary"
                aria-label={label}
                className="fixed end-6 bottom-6 z-30 hidden h-14 w-72 justify-start gap-3 rounded-full px-5 shadow-lg md:flex min-[90rem]:hidden"
              />
            )
          }
        >
          <Messages aria-hidden className="size-6" />
          <span className="font-semibold">{t("messages")}</span>
          <span className="ms-auto flex -space-x-2 rtl:space-x-reverse">
            {faces.map((face) => (
              <Avatar key={face.id} size="sm" className="ring-2 ring-secondary">
                <AvatarImage src={face.profilePicture?.url} alt="" />
                <AvatarFallback>
                  {face.username.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ))}
          </span>
          {count > 0 && (
            <span className="absolute -top-0.5 -end-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-xs font-semibold text-white tabular-nums ring-2 ring-background">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="end"
          sideOffset={12}
          className="h-[min(44rem,85svh)] max-h-(--available-height) w-[28rem] max-w-[calc(100vw-2rem)] gap-0 overflow-hidden overscroll-contain p-0"
        >
          {active ? (
            <ChatThread
              key={active}
              id={active}
              onBack={() => setActive(null)}
              compact
            />
          ) : (
            <ChatList onSelect={setActive} className="h-full" />
          )}
        </PopoverContent>
      </Popover>
    </>
  );
}

/** /direct's sidebar; on a phone it is the whole page and hides inside a chat. */
export function DirectInbox() {
  const pathname = usePathname();
  return (
    <ChatList
      className={cn(
        "w-full shrink-0 md:flex md:w-96 md:border-e",
        pathname === "/direct" ? "flex" : "hidden",
      )}
    />
  );
}

/** /direct on a desktop, before a chat is picked. */
export function DirectEmpty() {
  const t = useT();
  const router = useRouter();
  const [composing, setComposing] = useState(false);
  return (
    <div className="hidden h-full flex-col items-center justify-center gap-3 p-6 text-center md:flex">
      <span className="flex size-24 items-center justify-center rounded-full border-2 border-foreground">
        <Messages aria-hidden className="size-12" />
      </span>
      <h2 className="text-xl font-semibold">{t("yourMessages")}</h2>
      <p className="max-w-xs text-sm text-pretty text-muted-foreground">
        {t("yourMessagesBody")}
      </p>
      <Button onClick={() => setComposing(true)} className="mt-2">
        {t("sendMessage")}
      </Button>
      <NewChatDialog
        open={composing}
        onOpenChange={setComposing}
        onOpened={(id) => {
          setComposing(false);
          router.push(`/direct/${id}`);
        }}
      />
    </div>
  );
}
