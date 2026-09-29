"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Add,
  ChevronLeft,
  ChevronRight,
  Eye,
  Heart,
  MoreH,
  Pause,
  Play,
  Repeat3,
  Send,
  TextBlock,
  Star,
  TickCircle,
  Trash,
  X,
} from "reicon-react";

import type { EditedPostMedia } from "@/interfaces/post.interface";
import type {
  Story,
  StoryOverlay,
  StoryReel,
} from "@/interfaces/story.interface";
import { isVideoType } from "@/lib/files";
import { cn, getFullName, STORY_TTL_MS, timeAgo } from "@/lib/utils";
import { MESSAGE_MAX } from "@/lib/validations";
import type { Highlight } from "@/server/stories";
import {
  useCreateHighlightMutation,
  useDeleteHighlightMutation,
  useDeleteStoryMutation,
  useReplyToStoryMutation,
  useRepostStoryMutation,
  useSetStoryLikeMutation,
  useStoryViewersQuery,
  useViewStoryMutation,
  type ApiError,
} from "@/store/api";
import { useLang, useT } from "../i18n-provider";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Spinner } from "../ui/spinner";
import { toast } from "../ui/toast";

/** Dispatched on window; the nav opens Create in story mode. */
export const CREATE_STORY_EVENT = "framey:create-story";
export const openCreateStory = () =>
  window.dispatchEvent(new Event(CREATE_STORY_EVENT));

const IMAGE_SECONDS = 5;
/** Pressing this long pauses instead of stepping. */
const HOLD_MS = 200;
/** A drag this far (px) swipes to the next or previous person. */
const SWIPE = 80;

/** A photo, or a video's poster frame. */
export const storyThumb = (story: Story) =>
  isVideoType(story.type) ? story.cover?.url : story.url;

/**
 * Instagram's ring: the brand gradient while unseen (green when a
 * close-friends story is among them), a hairline once watched.
 */
export const storyRing = (seen: boolean, closeFriends = false) =>
  cn(
    "rounded-full p-[3px]",
    seen
      ? "bg-muted-foreground"
      : closeFriends
        ? "bg-green-500"
        : "bg-[conic-gradient(from_180deg,#f9ce34,#ee2a7b,#6228d7,#f9ce34)]",
  );

/** Whether an unwatched close-friends story should turn the ring green. */
export const hasUnseenCloseFriends = (stories: Story[]) =>
  stories.some((s) => s.closeFriends && !s.seen);

/**
 * The tray and profile ring are server-rendered, so a page left open would
 * keep showing a story past its 24 hours. Refresh when the oldest one expires.
 */
export function useStoryExpiry(stories: Story[]) {
  const router = useRouter();
  const oldest = stories.reduce(
    (min, s) => Math.min(min, new Date(s.createdAt).getTime()),
    Infinity,
  );
  useEffect(() => {
    if (oldest === Infinity) return;
    // setTimeout caps at ~24.8 days; a story's TTL is well under that.
    const id = setTimeout(
      () => router.refresh(),
      Math.max(0, oldest + STORY_TTL_MS - Date.now()),
    );
    return () => clearTimeout(id);
  }, [oldest, router]);
}

/**
 * Full-screen stories, Instagram-style: bars along the top, tap the left or
 * right side to step, reels play one after another. Photos last 5 seconds,
 * videos their length.
 */
export function StoryViewer({
  reels,
  startReel,
  startStory,
  onClose,
  title,
  highlightId,
}: {
  reels: StoryReel[];
  startReel: number;
  /** Defaults to the reel's first unseen story. */
  startStory?: number;
  onClose: () => void;
  /** A highlight's name, shown in place of the time. */
  title?: string;
  highlightId?: string;
}) {
  const router = useRouter();
  const t = useT();
  const lang = useLang();
  const { data: session } = useSession();
  const firstUnseen = (reel?: StoryReel) =>
    Math.max(0, reel?.stories.findIndex((s) => !s.seen) ?? 0);
  const [pos, setPos] = useState({
    reel: startReel,
    story: startStory ?? (highlightId ? 0 : firstUnseen(reels[startReel])),
  });
  const [paused, setPaused] = useState(false);
  const [viewStory] = useViewStoryMutation();
  const [deleteStory] = useDeleteStoryMutation();
  const [deleteHighlight] = useDeleteHighlightMutation();
  const [setStoryLike] = useSetStoryLikeMutation();
  const [replyToStory, { isLoading: replying }] = useReplyToStoryMutation();
  const [repostStoryTo, { isLoading: reposting }] = useRepostStoryMutation();
  // Loves flipped here, by story id: shown at once, undone if the server refuses.
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [reply, setReply] = useState("");
  const [viewersOpen, setViewersOpen] = useState(false);
  // Held down: paused until released. `drag`: how far a swipe has pulled the
  // frame (px); past SWIPE it moves to the next or previous person.
  const [held, setHeld] = useState(false);
  const [drag, setDrag] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const press = useRef<{
    x: number;
    timer: ReturnType<typeof setTimeout>;
    dragging: boolean;
    held: boolean;
  } | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const halted = paused || held || drag !== 0;

  const reel = reels[pos.reel];
  const story = reel?.stories[pos.story];
  const isMine = reel?.user.id === session?.user?.id;
  const isVideo = isVideoType(story?.type);

  const close = () => {
    onClose();
    // Seen rings and deletions show up in the server-rendered tray.
    router.refresh();
  };

  const goReel = (index: number) => {
    if (index < 0 || index >= reels.length || index === pos.reel) return;
    setDirection(index > pos.reel ? 1 : -1);
    setPos({ reel: index, story: firstUnseen(reels[index]) });
    setPaused(false);
  };

  /**
   * Next or previous story, across people. Running off the end closes the
   * viewer only when it happens by itself (the last story finished); a tap
   * there stays put.
   */
  const step = (by: 1 | -1, manual = false) => {
    if (!reel) return;
    const next = pos.story + by;
    if (next >= 0 && next < reel.stories.length) {
      setPos({ reel: pos.reel, story: next });
    } else if (by > 0 && pos.reel < reels.length - 1) {
      goReel(pos.reel + 1);
    } else if (by < 0 && pos.reel > 0) {
      setDirection(-1);
      setPos({ reel: pos.reel - 1, story: 0 });
    } else if (by > 0 && !manual) {
      close();
    }
    setPaused(false);
  };

  // A tap steps (left third back, the rest forward), a hold pauses until
  // release, a sideways drag (mouse or finger) swipes to another person.
  const onPressStart = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    press.current = {
      x: event.clientX,
      dragging: false,
      held: false,
      timer: setTimeout(() => {
        if (!press.current) return;
        press.current.held = true;
        setHeld(true);
      }, HOLD_MS),
    };
  };
  const onPressMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const current = press.current;
    if (!current) return;
    const dx = event.clientX - current.x;
    if (!current.dragging && Math.abs(dx) > 8) {
      current.dragging = true;
      clearTimeout(current.timer);
    }
    if (current.dragging) setDrag(dx);
  };
  const onPressEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const current = press.current;
    press.current = null;
    if (!current) return;
    clearTimeout(current.timer);
    setHeld(false);
    setDrag(0);
    if (current.dragging) {
      const dx = event.clientX - current.x;
      if (dx <= -SWIPE) goReel(pos.reel + 1);
      else if (dx >= SWIPE) goReel(pos.reel - 1);
      return;
    }
    if (current.held) return;
    const box = event.currentTarget.getBoundingClientRect();
    const back = (event.clientX - box.left) / box.width < 1 / 3;
    step(back !== (document.dir === "rtl") ? -1 : 1, true);
  };

  useEffect(() => {
    if (story && !story.seen) void viewStory(story.id);
  }, [story, viewStory]);

  useEffect(() => {
    if (halted) video.current?.pause();
    else void video.current?.play().catch(() => {});
  }, [halted, story]);

  const toggleLove = async () => {
    if (!story) return;
    const next = !(liked[story.id] ?? story.likedByMe);
    setLiked((l) => ({ ...l, [story.id]: next }));
    const result = await setStoryLike({ id: story.id, liked: next });
    if ("error" in result) {
      setLiked((l) => ({ ...l, [story.id]: !next }));
      toast.add({ type: "error", description: t("somethingWrong") });
    }
  };

  const repostStory = async () => {
    if (!story) return;
    const result = await repostStoryTo(story.id);
    toast.add(
      "error" in result
        ? {
            type: "error",
            description:
              (result.error as ApiError).data?.message ?? t("somethingWrong"),
          }
        : { description: t("repostedToYourStory") },
    );
  };

  const sendReply = async () => {
    const text = reply.trim();
    if (!story || !text || replying) return;
    setReply("");
    const result = await replyToStory({ id: story.id, text });
    if ("error" in result) {
      setReply(text);
      toast.add({
        type: "error",
        description:
          (result.error as ApiError).data?.message ?? t("sendFailed"),
      });
      return;
    }
    toast.add({ description: t("sent") });
    setPaused(false);
  };

  const remove = async () => {
    const result = highlightId
      ? await deleteHighlight(highlightId)
      : await deleteStory(story!.id);
    if ("error" in result) {
      toast.add({
        type: "error",
        description:
          (result.error as ApiError).data?.message ??
          t("deleteItFailed"),
      });
      return;
    }
    close();
  };

  if (!reel || !story) return null;

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") step(1, true);
          else if (event.key === "ArrowLeft") step(-1, true);
          else if (event.key === " ") setPaused((p) => !p);
          else return;
          event.preventDefault();
        }}
        className="inset-0 top-0 left-0 flex h-svh w-full max-w-none translate-x-0 translate-y-0 items-center justify-center overflow-hidden rounded-none bg-black p-0 text-white ring-0 sm:max-w-none"
      >
        <DialogTitle className="sr-only">
          {title ?? t("storyBy", { name: reel.user.username })}
        </DialogTitle>

        {/* Up to two people either side, small and dimmed (desktop); a click
            or a swipe brings one to the middle. */}
        {reels.map((other, i) => {
          const offset = i - pos.reel;
          if (offset === 0 || Math.abs(offset) > 2) return null;
          const cover = other.stories[firstUnseen(other)] ?? other.stories[0];
          const reach = Math.abs(offset) === 1 ? "169% + 1.5rem" : "269% + 3rem";
          return (
            <button
              key={other.user.id}
              type="button"
              onClick={() => goReel(i)}
              aria-label={t("storyBy", { name: other.user.username })}
              style={{
                transform: `translate(calc(-50% + ${Math.sign(offset)} * (${reach}) + ${drag}px), -50%)`,
              }}
              className="absolute top-1/2 left-1/2 hidden aspect-9/16 h-[calc((100svh-2rem)*0.42)] overflow-hidden rounded-lg bg-neutral-900 transition-transform duration-300 ease-out focus-visible:ring-3 focus-visible:ring-white/50 focus-visible:outline-none motion-reduce:transition-none md:block"
            >
              {cover && storyThumb(cover) && (
                <Image
                  src={storyThumb(cover)!}
                  alt=""
                  fill
                  sizes="20svh"
                  className="object-cover"
                />
              )}
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 p-2 text-center">
                <span className={cn("rounded-full p-0.5", storyRing(other.seen, hasUnseenCloseFriends(other.stories)))}>
                  <Avatar className="size-14 ring-2 ring-black">
                    <AvatarImage src={other.user.profilePicture?.url} alt="" />
                    <AvatarFallback>
                      {other.user.username.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </span>
                <span className="max-w-full truncate text-sm font-semibold">
                  {other.user.username}
                </span>
                {cover && (
                  <span className="text-xs text-white/70" suppressHydrationWarning>
                    {timeAgo(cover.createdAt, lang, t("timeNow"))}
                  </span>
                )}
              </span>
            </button>
          );
        })}

        <div
          key={pos.reel}
          style={drag ? { transform: `translateX(${drag}px)` } : undefined}
          className={cn(
            "relative aspect-9/16 h-full max-h-svh max-w-full overflow-hidden bg-neutral-900 duration-300 animate-in fade-in motion-reduce:animate-none md:h-[calc(100svh-2rem)] md:rounded-lg",
            direction > 0 ? "slide-in-from-right-12" : "slide-in-from-left-12",
          )}
        >
          {isVideo ? (
            <video
              key={story.id}
              ref={video}
              src={story.url}
              poster={story.cover?.url}
              autoPlay
              playsInline
              muted={story.muted}
              onEnded={() => step(1)}
              className="size-full object-contain"
            />
          ) : (
            <Image
              key={story.id}
              src={story.url}
              alt=""
              fill
              priority
              sizes="(min-width: 768px) 56svh, 100vw"
              quality={90}
              className="object-contain"
            />
          )}

          {/* Text sits in fractions of the frame; font sizes scale with its width. */}
          <div className="pointer-events-none absolute inset-0 @container">
            {story.overlays.map((o) => (
              <p
                key={o.id}
                style={{
                  left: `${o.x * 100}%`,
                  top: `${o.y * 100}%`,
                  fontSize: `${o.size * 100}cqw`,
                  color: o.color,
                  backgroundColor: o.background ? plateFor(o.color) : undefined,
                }}
                className="absolute max-w-[90%] -translate-x-1/2 -translate-y-1/2 rounded-lg px-[0.4em] py-[0.15em] text-center leading-tight font-semibold break-words whitespace-pre-wrap"
              >
                {o.text}
              </p>
            ))}
          </div>

          {/* Tap, hold or swipe anywhere on the frame (see onPress*). */}
          <div
            aria-hidden
            onPointerDown={onPressStart}
            onPointerMove={onPressMove}
            onPointerUp={onPressEnd}
            onPointerCancel={onPressEnd}
            onContextMenu={(event) => event.preventDefault()}
            className="absolute inset-0 cursor-pointer touch-pan-y select-none"
          />
          <span className="sr-only">
            <Button variant="ghost" onClick={() => step(-1, true)}>
              {t("previousStory")}
            </Button>
            <Button variant="ghost" onClick={() => step(1, true)}>
              {t("nextStory")}
            </Button>
          </span>

          <div
            className={cn(
              "pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-3 bg-linear-to-b from-black/50 to-transparent px-3 pt-3 pb-8 transition-opacity duration-200",
              held && "opacity-0",
            )}
          >
            <div className="flex gap-1">
              {reel.stories.map((s, i) => (
                <span
                  key={s.id}
                  className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/35"
                >
                  <span
                    key={i === pos.story ? s.id : undefined}
                    onAnimationEnd={
                      i === pos.story && !isVideo ? () => step(1) : undefined
                    }
                    style={
                      i === pos.story
                        ? {
                            animationDuration: `${isVideo ? (s.duration ?? 15) : IMAGE_SECONDS}s`,
                            animationPlayState: halted ? "paused" : "running",
                          }
                        : undefined
                    }
                    className={cn(
                      "block h-full origin-left bg-white",
                      i < pos.story && "scale-x-100",
                      i > pos.story && "scale-x-0",
                      i === pos.story && "animate-story-progress",
                    )}
                  />
                </span>
              ))}
            </div>
            <div className="pointer-events-auto flex items-center gap-2.5">
              <Link
                href={`/${reel.user.username}`}
                onClick={onClose}
                className="flex min-w-0 items-center gap-2.5 rounded-md focus-visible:ring-3 focus-visible:ring-white/50 focus-visible:outline-none"
              >
                <Avatar size="sm">
                  <AvatarImage src={reel.user.profilePicture?.url} alt="" />
                  <AvatarFallback>
                    {reel.user.username.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate text-sm font-semibold">
                  {title ?? reel.user.username}
                </span>
              </Link>
              <time
                dateTime={story.createdAt}
                className="shrink-0 text-sm text-white/70"
                suppressHydrationWarning
              >
                {timeAgo(story.createdAt, lang, t("timeNow"))}
              </time>
              {story.repostOf && (
                <Link
                  href={`/${story.repostOf}`}
                  onClick={onClose}
                  className="flex min-w-0 shrink items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold text-white"
                >
                  <Repeat3 aria-hidden className="size-3" />
                  <span className="truncate">{story.repostOf}</span>
                </Link>
              )}
              {story.closeFriends && (
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-green-500 px-2 py-0.5 text-xs font-semibold text-white">
                  <Star aria-hidden weight="Filled" className="size-3" />
                  {t("closeFriends")}
                </span>
              )}
              <span className="ml-auto flex items-center">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={paused ? t("play") : t("pause")}
                  onClick={() => setPaused((p) => !p)}
                  className="text-white hover:bg-white/10 hover:text-white"
                >
                  {paused ? (
                    <Play aria-hidden weight="Filled" />
                  ) : (
                    <Pause aria-hidden weight="Filled" />
                  )}
                </Button>
                {isMine && (
                  <DropdownMenu onOpenChange={setPaused}>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("storyOptions")}
                          className="text-foreground hover:bg-foreground/10 hover:text-foreground"
                        />
                      }
                    >
                      <MoreH aria-hidden size={20} weight="Filled" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 p-1.5">
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => void remove()}
                        className="h-10 gap-3 px-3"
                      >
                        <Trash aria-hidden size={20} />
                        {highlightId ? t("deleteHighlight") : t("deleteStory")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("close")}
                  onClick={close}
                  className="text-white hover:bg-white/10 hover:text-white"
                >
                  <X aria-hidden />
                </Button>
              </span>
            </div>
          </div>

          <div
            className={cn(
              "absolute inset-x-0 bottom-0 flex items-center gap-2 bg-linear-to-t from-black/60 to-transparent px-3 pt-10 pb-4 transition-opacity duration-200",
              held && "pointer-events-none opacity-0",
            )}
          >
            {isMine ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setPaused(true);
                  setViewersOpen(true);
                }}
                className="h-9 gap-2 px-2 text-white hover:bg-white/10 hover:text-white"
              >
                <Eye aria-hidden className="size-5" />
                {t("seenByCount", { count: String(story.viewCount) })}
                {story.likeCount > 0 && (
                  <span className="flex items-center gap-1">
                    <Heart aria-hidden weight="Filled" className="size-4 text-destructive" />
                    {story.likeCount}
                  </span>
                )}
              </Button>
            ) : (
              <>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void sendReply();
                  }}
                  className="flex h-11 min-w-0 flex-1 items-center rounded-full border border-white/60 ps-4 pe-1"
                >
                  <input
                    value={reply}
                    maxLength={MESSAGE_MAX}
                    onChange={(event) => setReply(event.target.value)}
                    onFocus={() => setPaused(true)}
                    onBlur={() => !reply.trim() && setPaused(false)}
                    onKeyDown={(event) => event.stopPropagation()}
                    placeholder={t("replyToStory", { name: reel.user.username })}
                    aria-label={t("replyToStory", { name: reel.user.username })}
                    className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/70"
                  />
                  {reply.trim() && (
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("send")}
                      disabled={replying}
                      className="text-white hover:bg-white/10 hover:text-white"
                    >
                      <Send aria-hidden className="size-5" />
                    </Button>
                  )}
                </form>
                {!story.closeFriends && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t("repostToStory")}
                    disabled={reposting}
                    onClick={() => void repostStory()}
                    className="shrink-0 text-white hover:bg-white/10 hover:text-white active:scale-90"
                  >
                    <Repeat3 aria-hidden className="size-6" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  aria-pressed={liked[story.id] ?? story.likedByMe}
                  aria-label={(liked[story.id] ?? story.likedByMe) ? t("unlike") : t("like")}
                  onClick={() => void toggleLove()}
                  className="shrink-0 text-white hover:bg-white/10 hover:text-white active:scale-90"
                >
                  <Heart
                    aria-hidden
                    weight={(liked[story.id] ?? story.likedByMe) ? "Filled" : "Outline"}
                    className={cn("size-7", (liked[story.id] ?? story.likedByMe) && "text-destructive")}
                  />
                </Button>
              </>
            )}
          </div>
        </div>

        {isMine && viewersOpen && (
          <StoryViewers
            storyId={story.id}
            onClose={() => {
              setViewersOpen(false);
              setPaused(false);
            }}
          />
        )}

        {pos.reel > 0 || pos.story > 0 ? (
          <Button
            variant="secondary"
            size="icon-sm"
            aria-label={t("previousStory")}
            onClick={() => step(-1, true)}
            className="absolute top-1/2 left-[calc(50%-(100svh-2rem)*9/32-3rem)] z-10 hidden -translate-y-1/2 rounded-full md:flex"
          >
            <ChevronLeft aria-hidden />
          </Button>
        ) : null}
        <Button
          variant="secondary"
          size="icon-sm"
          aria-label={t("nextStory")}
          onClick={() => step(1, true)}
          className="absolute top-1/2 right-[calc(50%-(100svh-2rem)*9/32-3rem)] z-10 hidden -translate-y-1/2 rounded-full md:flex"
        >
          <ChevronRight aria-hidden />
        </Button>
      </DialogContent>
    </Dialog>
  );
}

/** A text plate that contrasts with the text: dark behind light, light behind dark. */
const plateFor = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const luminance =
    (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return luminance > 0.6 ? "rgb(0 0 0 / 0.65)" : "rgb(255 255 255 / 0.9)";
};

const TEXT_COLORS = [
  "#ffffff",
  "#000000",
  "#f43f5e",
  "#f59e0b",
  "#22c55e",
  "#3b82f6",
  "#a855f7",
];

/**
 * Text on a new story before it's shared: "Aa" adds a line, drag it where it
 * goes, then pick its colour, plate and size. The media itself isn't touched;
 * the text rides along as data and the viewer draws it.
 */
export function StoryTextStep({
  media,
  overlays,
  onChange,
  onNext,
}: {
  media: EditedPostMedia;
  overlays: StoryOverlay[];
  onChange: (overlays: StoryOverlay[]) => void;
  onNext: () => void;
}) {
  const t = useT();
  const frame = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(overlays[0]?.id ?? null);
  // ponytail: never revoked (dev's double effects would revoke it while in
  // use); one blob per story created, freed with the tab.
  const src = useMemo(() => URL.createObjectURL(media.file), [media.file]);
  const video = isVideoType(media.file.type);
  const current = overlays.find((o) => o.id === selected);

  const update = (id: string, patch: Partial<StoryOverlay>) =>
    onChange(overlays.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  const add = () => {
    const overlay: StoryOverlay = {
      id: crypto.randomUUID(),
      text: t("storyTextPlaceholder"),
      x: 0.5,
      y: 0.4 + overlays.length * 0.08,
      color: "#ffffff",
      background: false,
      size: 0.07,
    };
    onChange([...overlays, overlay]);
    setSelected(overlay.id);
  };
  const drag = (id: string) => (event: React.PointerEvent<HTMLElement>) => {
    const box = frame.current?.getBoundingClientRect();
    if (!box) return;
    setSelected(id);
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    const move = (e: PointerEvent) =>
      update(id, {
        x: Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)),
        y: Math.min(1, Math.max(0, (e.clientY - box.top) / box.height)),
      });
    const up = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
  };

  return (
    <div className="flex flex-col gap-3 p-4 md:flex-row">
      <div
        ref={frame}
        className="relative mx-auto aspect-9/16 h-[min(60svh,34rem)] shrink-0 touch-none overflow-hidden rounded-lg bg-black @container"
      >
        {video ? (
            <video src={src} autoPlay muted loop playsInline className="size-full object-contain" />
          ) : (
            // A local blob: next/image can't optimise it.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" className="size-full object-contain" />
          )}
        {overlays.map((o) => (
          <p
            key={o.id}
            onPointerDown={drag(o.id)}
            style={{
              left: `${o.x * 100}%`,
              top: `${o.y * 100}%`,
              fontSize: `${o.size * 100}cqw`,
              color: o.color,
              backgroundColor: o.background ? plateFor(o.color) : undefined,
            }}
            className={cn(
              "absolute max-w-[90%] -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-lg px-[0.4em] py-[0.15em] text-center leading-tight font-semibold break-words whitespace-pre-wrap select-none active:cursor-grabbing",
              o.id === selected && "outline-2 outline-offset-2 outline-white/80 outline-dashed",
            )}
          >
            {o.text}
          </p>
        ))}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3 md:w-64">
        <Button variant="secondary" onClick={add} disabled={overlays.length >= 10} className="gap-2">
          <TextBlock aria-hidden className="size-5" />
          {t("addText")}
        </Button>
        {current && (
          <>
            <textarea
              value={current.text}
              maxLength={200}
              rows={2}
              onChange={(event) => update(current.id, { text: event.target.value })}
              aria-label={t("storyText")}
              className="w-full resize-none rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            <div role="radiogroup" aria-label={t("textColor")} className="flex flex-wrap gap-2">
              {TEXT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  role="radio"
                  aria-checked={current.color === color}
                  aria-label={color}
                  onClick={() => update(current.id, { color })}
                  style={{ backgroundColor: color }}
                  className={cn(
                    "size-7 rounded-full ring-1 ring-foreground/20",
                    current.color === color && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
                  )}
                />
              ))}
            </div>
            <label className="flex items-center justify-between gap-3 text-sm">
              {t("textBackground")}
              <input
                type="checkbox"
                checked={current.background}
                onChange={(event) => update(current.id, { background: event.target.checked })}
                className="size-4 accent-foreground"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {t("textSize")}
              <input
                type="range"
                min={0.03}
                max={0.2}
                step={0.005}
                value={current.size}
                onChange={(event) => update(current.id, { size: Number(event.target.value) })}
                className="accent-foreground"
              />
            </label>
            <Button
              variant="ghost"
              onClick={() => {
                onChange(overlays.filter((o) => o.id !== current.id));
                setSelected(null);
              }}
              className="gap-2 text-destructive hover:text-destructive"
            >
              <Trash aria-hidden className="size-5" />
              {t("removeText")}
            </Button>
          </>
        )}
        <Button onClick={onNext} className="mt-auto">
          {t("next")}
        </Button>
      </div>
    </div>
  );
}

/** The author's "Seen by" list; a heart marks who loved the story. */
function StoryViewers({ storyId, onClose }: { storyId: string; onClose: () => void }) {
  const t = useT();
  const { data, isLoading, isError } = useStoryViewersQuery(storyId);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[70svh] flex-col gap-0 overflow-hidden p-0 sm:max-w-sm">
        <DialogHeader className="h-12 flex-row items-center justify-center border-b px-4">
          <DialogTitle>{t("viewers")}</DialogTitle>
          <DialogDescription className="sr-only">{t("viewers")}</DialogDescription>
        </DialogHeader>
        <div className="min-h-40 overflow-y-auto p-2">
          {isLoading ? (
            <div className="flex h-36 items-center justify-center">
              <Spinner />
            </div>
          ) : isError ? (
            <p className="px-3 py-10 text-center text-sm text-muted-foreground">
              {t("listLoadFailed")}
            </p>
          ) : !data?.length ? (
            <p className="px-3 py-10 text-center text-sm text-muted-foreground">
              {t("noViewersYet")}
            </p>
          ) : (
            <ul className="flex flex-col">
              {data.map((viewer) => (
                <li key={viewer.id}>
                  <Link
                    href={`/${viewer.username}`}
                    onClick={onClose}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors duration-150 hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none"
                  >
                    <Avatar size="lg">
                      <AvatarImage src={viewer.profilePicture?.url} alt="" />
                      <AvatarFallback>
                        {viewer.username.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="block truncate font-semibold">{viewer.username}</span>
                      <span className="block truncate text-muted-foreground">
                        {getFullName(viewer.firstName, viewer.lastName)}
                      </span>
                    </span>
                    {viewer.liked && (
                      <Heart
                        aria-label={t("lovedIt")}
                        weight="Filled"
                        className="size-5 shrink-0 text-destructive"
                      />
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** The feed's top row: your story first, then everyone you follow. */
export function StoryTray({
  reels,
  me,
}: {
  reels: StoryReel[];
  me: StoryReel["user"];
}) {
  const t = useT();
  const [openAt, setOpenAt] = useState<number | null>(null);
  const hasMine = reels[0]?.user.id === me.id;
  useStoryExpiry(reels.flatMap((r) => r.stories));

  return (
    <>
      <ul
        aria-label={t("stories")}
        className="flex h-26 shrink-0 items-center gap-4 overflow-x-auto px-4 md:justify-center-safe"
      >
        {!hasMine && (
          <li className="shrink-0">
            <Button
              variant="ghost"
              onClick={openCreateStory}
              className="h-auto w-18 flex-col gap-1.5 p-0 font-normal hover:bg-transparent"
            >
              <span className="relative rounded-full p-0.75">
                <Avatar className="size-14">
                  <AvatarImage src={me.profilePicture?.url} alt="" />
                  <AvatarFallback>
                    {me.username.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="absolute right-0 bottom-0 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background">
                  <Add aria-hidden className="size-3.5" />
                </span>
              </span>
              <span className="w-full truncate text-xs text-muted-foreground">
                {t("yourStory")}
              </span>
            </Button>
          </li>
        )}
        {reels.map((reel, i) => {
          const mine = reel.user.id === me.id;
          return (
            <li key={reel.user.id} className="relative shrink-0">
              <Button
                variant="ghost"
                onClick={() => setOpenAt(i)}
                aria-label={`${mine ? t("yourStory") : t("storyBy", { name: reel.user.username })}${reel.seen ? "" : `, ${t("newLabel")}`}`}
                className="h-auto w-18 flex-col gap-1.5 p-0 font-normal hover:bg-transparent"
              >
                <span
                  className={storyRing(
                    reel.seen,
                    hasUnseenCloseFriends(reel.stories),
                  )}
                >
                  <Avatar className="size-14 ring-2 ring-background">
                    <AvatarImage src={reel.user.profilePicture?.url} alt="" />
                    <AvatarFallback>
                      {reel.user.username.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </span>
                <span
                  className={cn(
                    "w-full truncate text-xs",
                    reel.seen && "text-muted-foreground",
                  )}
                >
                  {mine ? t("yourStory") : reel.user.username}
                </span>
              </Button>
              {mine && (
                <Button
                  size="icon-xs"
                  aria-label={t("addToStory")}
                  onClick={openCreateStory}
                  className="absolute top-11 right-1 rounded-full ring-2 ring-background"
                >
                  <Add aria-hidden />
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {openAt !== null && (
        <StoryViewer
          reels={reels}
          startReel={openAt}
          onClose={() => setOpenAt(null)}
        />
      )}
    </>
  );
}

/**
 * The profile's highlight circles under the header. The owner gets a New
 * circle that bundles stories from their archive under a name.
 */
export function Highlights({
  user,
  highlights,
  archive,
}: {
  user: StoryReel["user"];
  highlights: Highlight[];
  /** The owner's story archive; null on someone else's profile. */
  archive: Story[] | null;
}) {
  const router = useRouter();
  const t = useT();
  const lang = useLang();
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [createHighlight, { isLoading }] = useCreateHighlightMutation();
  const open = highlights.find((h) => h.id === openId);

  if (!highlights.length && !archive) return null;

  const create = async () => {
    const result = await createHighlight({
      title: title.trim(),
      storyIds: [...picked],
    });
    if ("error" in result) {
      toast.add({
        type: "error",
        description:
          (result.error as ApiError).data?.message ??
          t("highlightCreateFailed"),
      });
      return;
    }
    setCreating(false);
    setTitle("");
    setPicked(new Set());
    router.refresh();
  };

  return (
    <>
      <ul
        aria-label={t("highlights")}
        className="flex gap-4 overflow-x-auto px-4 py-2 md:justify-center-safe md:gap-8"
      >
        {highlights.map((h) => {
          const cover = storyThumb(h.stories[0]!);
          return (
            <li key={h.id} className="shrink-0">
              <Button
                variant="ghost"
                onClick={() => setOpenId(h.id)}
                className="h-auto w-20 flex-col gap-2 p-0 font-normal hover:bg-transparent"
              >
                <span className="rounded-full p-0.75 ring-1 ring-border">
                  <span className="relative block size-16 overflow-hidden rounded-full bg-muted md:size-18">
                    {cover && (
                      <Image
                        src={cover}
                        alt=""
                        fill
                        sizes="72px"
                        className="object-cover"
                      />
                    )}
                  </span>
                </span>
                <span className="w-full truncate text-xs font-medium">
                  {h.title}
                </span>
              </Button>
            </li>
          );
        })}
        {archive && (
          <li className="shrink-0">
            <Button
              variant="ghost"
              onClick={() => setCreating(true)}
              className="h-auto w-20 flex-col gap-2 p-0 font-normal hover:bg-transparent!"
            >
              <span className="rounded-full p-0.75 ring-1 ring-border">
                <span className="flex size-16 items-center justify-center rounded-full bg-muted md:size-18">
                  <Add aria-hidden className="size-7" />
                </span>
              </span>
              <span className="text-xs font-medium">{t("newLabel")}</span>
            </Button>
          </li>
        )}
      </ul>

      {open && (
        <StoryViewer
          reels={[{ user, stories: open.stories, seen: true }]}
          startReel={0}
          title={open.title}
          highlightId={archive ? open.id : undefined}
          onClose={() => setOpenId(null)}
        />
      )}

      {archive && (
        <Dialog
          open={creating}
          onOpenChange={(next) => !isLoading && setCreating(next)}
        >
          <DialogContent className="gap-0 p-0 sm:max-w-lg">
            <DialogHeader className="border-b px-5 py-4">
              <DialogTitle>{t("newHighlight")}</DialogTitle>
              <DialogDescription>
                {t("newHighlightBody")}
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void create();
              }}
              className="flex flex-col gap-4 p-5"
            >
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={30}
                placeholder={t("highlightName")}
                aria-label={t("highlightName")}
                disabled={isLoading}
              />
              {archive.length ? (
                <ul className="grid max-h-[50svh] grid-cols-3 gap-1 overflow-y-auto sm:grid-cols-4">
                  {archive.map((story) => {
                    const thumb = storyThumb(story);
                    const on = picked.has(story.id);
                    return (
                      <li key={story.id}>
                        <Button
                          variant="ghost"
                          aria-pressed={on}
                          aria-label={t("storyFrom", { date: new Date(story.createdAt).toLocaleDateString(lang) })}
                          onClick={() =>
                            setPicked((p) => {
                              const next = new Set(p);
                              if (on) next.delete(story.id);
                              else next.add(story.id);
                              return next;
                            })
                          }
                          className="relative block aspect-9/16 h-auto w-full overflow-hidden rounded-sm bg-muted p-0 hover:bg-muted"
                        >
                          {thumb && (
                            <Image
                              src={thumb}
                              alt=""
                              fill
                              sizes="120px"
                              className={cn(
                                "object-cover transition-opacity",
                                on && "opacity-70",
                              )}
                            />
                          )}
                          {on && (
                            <TickCircle
                              aria-hidden
                              weight="Filled"
                              className="absolute end-1.5 bottom-1.5 size-5 text-white drop-shadow"
                            />
                          )}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {t("shareStoryFirst")}
                </p>
              )}
              <Button
                type="submit"
                disabled={isLoading || !title.trim() || picked.size === 0}
              >
                {isLoading ? <Spinner /> : t("addHighlight")}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

/** Every story you've shared, newest first; open one to watch from there. */
export function StoryArchive({
  user,
  stories,
}: {
  user: StoryReel["user"];
  stories: Story[];
}) {
  const t = useT();
  const lang = useLang();
  const [openAt, setOpenAt] = useState<number | null>(null);
  // The viewer plays oldest to newest.
  const chronological = [...stories].reverse();

  if (!stories.length) {
    return (
      <p className="px-6 py-20 text-center text-sm text-muted-foreground">
        {t("storyArchiveEmpty")}
      </p>
    );
  }

  return (
    <>
      <ul className="grid grid-cols-3 gap-1 md:grid-cols-4 lg:grid-cols-6">
        {stories.map((story, i) => {
          const thumb = storyThumb(story);
          const date = new Date(story.createdAt);
          return (
            <li key={story.id}>
              <Button
                variant="ghost"
                onClick={() => setOpenAt(stories.length - 1 - i)}
                aria-label={t("storyFrom", { date: date.toLocaleDateString(lang) })}
                className="relative block aspect-9/16 h-auto w-full overflow-hidden rounded-sm bg-muted p-0 hover:bg-muted"
              >
                {thumb && (
                  <Image
                    src={thumb}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 16vw, 33vw"
                    className="object-cover"
                  />
                )}
                <span className="absolute start-2 top-2 flex flex-col items-center rounded-md bg-background/90 px-2 py-1 text-xs leading-tight font-semibold">
                  <span className="text-base">{date.getDate()}</span>
                  {date.toLocaleDateString(lang, { month: "short" })}
                </span>
              </Button>
            </li>
          );
        })}
      </ul>
      {openAt !== null && (
        <StoryViewer
          reels={[{ user, stories: chronological, seen: true }]}
          startReel={0}
          startStory={openAt}
          onClose={() => setOpenAt(null)}
        />
      )}
    </>
  );
}
