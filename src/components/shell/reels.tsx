"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Archive,
  ArchiveSlash,
  ArrowDown2,
  ArrowUp2,
  Bookmark,
  Comment,
  Copy,
  Heart,
  MoreH,
  Repeat3,
  Send,
  Trash,
} from "reicon-react";

import type { FeedPost } from "@/interfaces/post.interface";
import { cn } from "@/lib/utils";
import {
  useArchivePostMutation,
  useDeletePostMutation,
  useLazyReelsQuery,
  useSetFollowMutation,
  useSetLikeMutation,
  useSetRepostMutation,
  useSetSavedMutation,
  type ApiError,
} from "@/store/api";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { useLang, useT } from "../i18n-provider";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../ui/sheet";
import { Spinner } from "../ui/spinner";
import { toast } from "../ui/toast";
import { CommentBox, CommentList, type CommentReply } from "./comments";
import Mentions from "./mentions";
import PostMedia from "./post-media";
import SavePost from "./save-post";
import { ShareToDialog } from "./share-to";

const REEL_RATIO = 9 / 16;
const LONG_CAPTION = 60;

/** Floating controls on media: the one place pills and shadow are allowed. */
const pill =
  "rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur-sm";

const actionClass =
  "size-11 active:scale-90 hover:scale-105 hover:bg-transparent! motion-reduce:transition-none";

const scrollBehavior = (): ScrollBehavior =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";

/**
 * One reel per screen, snapping on every scroll. Starts on the linked reel,
 * then random ones load ahead; the address follows the reel on screen.
 */
export default function Reels({ initial }: { initial: FeedPost }) {
  const [reels, setReels] = useState([initial]);
  const [current, setCurrent] = useState(0);
  const [done, setDone] = useState(false);
  const t = useT();
  const [fetchReels, { isFetching }] = useLazyReelsQuery();
  const scroller = useRef<HTMLDivElement>(null);

  // Keep a couple of reels ready below the one on screen.
  useEffect(() => {
    if (done || isFetching || current < reels.length - 2) return;
    void fetchReels(reels.map((r) => r.id).slice(-200)).then(({ data }) => {
      if (!data) return;
      if (!data.length) setDone(true);
      setReels((list) => {
        const seen = new Set(list.map((r) => r.id));
        return [...list, ...data.filter((r) => !seen.has(r.id))];
      });
    });
  }, [current, reels, done, isFetching, fetchReels]);

  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          setCurrent(Number(el.dataset.index));
          window.history.replaceState(null, "", `/reels/${el.dataset.id}`);
        }
      },
      { root, threshold: 0.6 },
    );
    for (const reel of root.querySelectorAll("section")) observer.observe(reel);
    return () => observer.disconnect();
  }, [reels]);

  useEffect(() => scroller.current?.focus(), []);

  const step = (by: number) => {
    const el = scroller.current;
    el?.scrollBy({ top: by * el.clientHeight, behavior: scrollBehavior() });
  };

  return (
    <div className="relative">
      <div
        ref={scroller}
        tabIndex={0}
        aria-label={t("reels")}
        className="h-[calc(100svh-3.5rem-env(safe-area-inset-bottom))] snap-y snap-mandatory overflow-y-auto overscroll-contain focus-visible:outline-none md:h-svh"
      >
        {reels.map((reel, i) => (
          <section
            key={reel.id}
            data-index={i}
            data-id={reel.id}
            aria-label={t("reelBy", { name: reel.author.username })}
            className="h-full snap-start snap-always"
          >
            <Reel
              post={reel}
              priority={i === 0}
              onDeleted={() =>
                setReels((list) => list.filter((r) => r.id !== reel.id))
              }
            />
          </section>
        ))}
        {!done && reels.length > 1 && (
          <div className="flex h-24 items-center justify-center">
            <Spinner
              className="size-6 text-muted-foreground"
              aria-label={t("loadingMoreReels")}
            />
          </div>
        )}
      </div>

      <div className="fixed top-1/2 right-4 z-10 hidden -translate-y-1/2 flex-col gap-3 md:flex">
        <Button
          variant="secondary"
          size="icon"
          aria-label={t("previousReel")}
          disabled={current === 0}
          onClick={() => step(-1)}
          className={pill}
        >
          <ArrowUp2 aria-hidden className="size-5" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          aria-label={t("nextReel")}
          disabled={current >= reels.length - 1}
          onClick={() => step(1)}
          className={pill}
        >
          <ArrowDown2 aria-hidden className="size-5" />
        </Button>
      </div>
    </div>
  );
}

/** Video full height in the middle, the author and caption to its left, actions to its right. */
function Reel({
  post,
  priority,
  onDeleted,
}: {
  post: FeedPost;
  priority: boolean;
  onDeleted: () => void;
}) {
  const { data: session } = useSession();
  const isMine = session?.user?.id === post.author.id;
  const [like, setLikeState] = useState({
    liked: post.likedByMe,
    count: post.likeCount,
  });
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [reply, setReply] = useState<CommentReply | null>(null);
  const commentInput = useRef<HTMLTextAreaElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [follow, setFollowState] = useState<"none" | "following" | "requested">(
    post.followingAuthor ? "following" : "none",
  );
  const [setLike] = useSetLikeMutation();
  const [repost, setRepostState] = useState({
    reposted: post.repostedByMe,
    count: post.repostCount,
  });
  const [setRepost] = useSetRepostMutation();
  const [setFollow, { isLoading: following }] = useSetFollowMutation();
  const [saved, setSavedLocal] = useState(post.savedByMe);
  // Bumped when the menu saves, so the bookmark remounts with the new state.
  const [saveKey, setSaveKey] = useState(0);
  const [archived, setArchived] = useState(post.archived);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [setSaved] = useSetSavedMutation();
  const t = useT();
  const lang = useLang();
  const [archivePost] = useArchivePostMutation();
  const [deletePost, { isLoading: deleting }] = useDeletePostMutation();
  // Only the newest like request may settle the state.
  const latest = useRef(0);

  const caption = post.caption ?? "";
  const isLong = caption.length > LONG_CAPTION || caption.includes("\n");

  // Optimistic: flip now, settle on the server's answer.
  const toggleRepost = async () => {
    const before = repost;
    const reposted = !repost.reposted;
    setRepostState({ reposted, count: repost.count + (reposted ? 1 : -1) });
    const result = await setRepost({ postId: post.id, reposted });
    if ("error" in result) {
      setRepostState(before);
      toast.add({
        type: "error",
        description:
          (result.error as ApiError).data?.message ?? t("somethingWrong"),
      });
      return;
    }
    setRepostState({
      reposted: result.data.reposted,
      count: result.data.repostCount,
    });
    if (reposted) toast.add({ description: t("repostedToast") });
  };

  const toggleLike = async (liked: boolean) => {
    if (liked === like.liked) return;
    const before = like;
    const request = ++latest.current;
    setLikeState({ liked, count: like.count + (liked ? 1 : -1) });
    const result = await setLike({ postId: post.id, liked });
    if (request !== latest.current) return;
    if ("error" in result) {
      setLikeState(before);
      toast.add({
        type: "error",
        description: t("likeFailed"),
      });
    } else {
      setLikeState({ liked: result.data.liked, count: result.data.likeCount });
    }
  };

  const followAuthor = async () => {
    const result = await setFollow({
      username: post.author.username,
      following: true,
    });
    if ("error" in result) {
      toast.add({
        type: "error",
        description:
          (result.error as ApiError).data?.message ??
          t("followFailed", { name: post.author.username }),
      });
      return;
    }
    setFollowState(result.data.requested ? "requested" : "following");
  };

  const toggleSave = async () => {
    const result = await setSaved({ postId: post.id, saved: !saved });
    if ("error" in result) {
      toast.add({
        type: "error",
        description: t("savedUpdateFailed"),
      });
      return;
    }
    setSavedLocal(!saved);
    setSaveKey((k) => k + 1);
  };

  const archive = async () => {
    const result = await archivePost({ postId: post.id, archived: !archived });
    if ("error" in result) {
      toast.add({
        type: "error",
        description:
          (result.error as ApiError).data?.message ?? t("reelUpdateFailed"),
      });
      return;
    }
    toast.add({
      description: archived ? t("reelRestored") : t("reelArchived"),
    });
    setArchived(!archived);
  };

  const remove = async () => {
    const result = await deletePost(post.id);
    if ("error" in result) {
      toast.add({
        type: "error",
        description: t("reelDeleteFailed"),
      });
      return;
    }
    setConfirmDelete(false);
    onDeleted();
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(
        `${location.origin}/reels/${post.id}`,
      );
      toast.add({ description: t("linkCopied") });
    } catch {
      toast.add({ type: "error", description: t("copyLinkFailed") });
    }
  };

  return (
    <article className="flex h-full items-center justify-center gap-3 px-2 py-4">
      {/* Left of the video, along its foot. */}
      <div className="flex max-h-full min-w-32 flex-1 basis-0 flex-col items-end self-end pb-2 text-sm">
        <div className="flex min-h-0 w-fit max-w-72 flex-col gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Link href={`/${post.author.username}`} tabIndex={-1} aria-hidden>
              <Avatar size="sm">
                <AvatarImage src={post.author.profilePicture?.url} alt="" />
                <AvatarFallback className="bg-muted text-muted-foreground">
                  {post.author.username.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </Link>
            <Link
              href={`/${post.author.username}`}
              className="truncate font-semibold hover:underline hover:underline-offset-4"
            >
              {post.author.username}
            </Link>
            {!isMine && follow !== "following" && (
              <>
                <span aria-hidden>·</span>
                <Button
                  variant="link"
                  disabled={following || follow === "requested"}
                  onClick={() => void followAuthor()}
                  className="h-auto p-0 font-semibold disabled:opacity-80 text-sky-600"
                >
                  {follow === "requested" ? t("requested") : t("follow")}
                </Button>
              </>
            )}
          </div>
          {caption && (
            <div
              className={cn(
                "min-h-0 leading-snug",
                expanded && "overflow-y-auto",
              )}
            >
              <p
                className={cn(
                  "wrap-break-word whitespace-pre-line text-pretty",
                  !expanded && "line-clamp-1",
                )}
              >
                <Mentions text={caption} />
              </p>
              {isLong && (
                <Button
                  variant="link"
                  aria-expanded={expanded}
                  aria-label={expanded ? t("showLess") : t("showFullCaption")}
                  onClick={() => setExpanded((e) => !e)}
                  className="h-auto p-0 text-muted-foreground hover:text-foreground hover:no-underline"
                >
                  {expanded ? "less" : "…"}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="relative flex aspect-9/16 h-full min-w-0 items-center overflow-hidden bg-black md:rounded-lg">
        <PostMedia
          media={post.media}
          ratio={REEL_RATIO}
          priority={priority}
          onDoubleTap={() => void toggleLike(true)}
        />
      </div>

      {/* Right of the video, bottom-up: more, save, share, comments, likes. */}
      <div className="flex flex-1 basis-0 flex-col items-start gap-3 self-end pb-2">
        <div className="flex flex-col items-center">
          <Button
            variant="ghost"
            size="icon"
            aria-pressed={like.liked}
            aria-label={like.liked ? t("unlike") : t("like")}
            onClick={() => void toggleLike(!like.liked)}
            className={actionClass}
          >
            <Heart
              aria-hidden
              weight={like.liked ? "Filled" : "Outline"}
              className={cn("size-7", like.liked && "text-destructive")}
            />
          </Button>
          {(!post.hidePostInfo || isMine) && (
            <span
              className="text-xs font-semibold tabular-nums"
              aria-live="polite"
            >
              {like.count.toLocaleString(lang)}
              <span className="sr-only"> {t("likesLabel")}</span>
            </span>
          )}
        </div>
        {!post.hideComments && (
          <div className="flex flex-col items-center">
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("comments")}
              aria-expanded={commentsOpen}
              onClick={() => setCommentsOpen(true)}
              className={actionClass}
            >
              <Comment aria-hidden className="size-7" />
            </Button>
            <span className="text-xs font-semibold tabular-nums">
              {commentCount.toLocaleString(lang)}
              <span className="sr-only"> {t("commentsLabel")}</span>
            </span>
          </div>
        )}
        {!isMine && (
          <div className="flex flex-col items-center">
            <Button
              variant="ghost"
              size="icon"
              aria-pressed={repost.reposted}
              aria-label={repost.reposted ? t("undoRepost") : t("repost")}
              onClick={() => void toggleRepost()}
              className={actionClass}
            >
              <Repeat3
                aria-hidden
                className={cn("size-7", repost.reposted && "text-emerald-500")}
              />
            </Button>
            <span className="text-xs font-semibold tabular-nums">
              {repost.count.toLocaleString(lang)}
            </span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("shareTo")}
          onClick={() => setShareOpen(true)}
          className={actionClass}
        >
          <Send aria-hidden className="size-7" />
        </Button>
        <SavePost
          key={saveKey}
          postId={post.id}
          saved={saved}
          onSavedChange={setSavedLocal}
          className={actionClass}
        />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("more")}
                className={actionClass}
              />
            }
          >
            <MoreH aria-hidden size={20} weight="Filled" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="left" align="end" className="w-48 p-1.5">
            <DropdownMenuItem
              onClick={() => setShareOpen(true)}
              className="h-10 gap-3 px-3"
            >
              <Send aria-hidden size={20} />
              {t("shareTo")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => void copyLink()}
              className="h-10 gap-3 px-3"
            >
              <Copy aria-hidden size={20} />
              {t("copyLink")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => void toggleSave()}
              className="h-10 gap-3 px-3"
            >
              <Bookmark
                aria-hidden
                size={20}
                weight={saved ? "Filled" : "Outline"}
              />
              {saved ? t("unsave") : t("save")}
            </DropdownMenuItem>
            {isMine && (
              <>
                <DropdownMenuItem
                  onClick={() => void archive()}
                  className="h-10 gap-3 px-3"
                >
                  {archived ? (
                    <ArchiveSlash aria-hidden size={20} />
                  ) : (
                    <Archive aria-hidden size={20} />
                  )}
                  {archived ? t("showOnProfile") : t("archive")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setConfirmDelete(true)}
                  className="h-10 gap-3 px-3"
                >
                  <Trash aria-hidden size={20} />
                  {t("delete")}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {!post.hideComments && (
        <Sheet open={commentsOpen} onOpenChange={setCommentsOpen}>
          <SheetContent side="right" className="gap-0 p-0 sm:max-w-md">
            <SheetHeader className="border-b px-4 py-3">
              <SheetTitle>{t("comments")}</SheetTitle>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 text-sm">
              <CommentList
                postId={post.id}
                onReply={(next) => {
                  setReply(next);
                  commentInput.current?.focus();
                }}
                onCountChange={(delta) =>
                  setCommentCount((n) => Math.max(0, n + delta))
                }
              />
            </div>
            <CommentBox
              postId={post.id}
              reply={reply}
              inputRef={commentInput}
              onCancelReply={() => setReply(null)}
              onPosted={() => {
                setReply(null);
                setCommentCount((n) => n + 1);
              }}
              className="border-t px-4 py-2"
            />
          </SheetContent>
        </Sheet>
      )}
      <Dialog
        open={confirmDelete}
        onOpenChange={(open) => !deleting && setConfirmDelete(open)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("deleteReelTitle")}</DialogTitle>
            <DialogDescription>{t("deleteReelBody")}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              disabled={deleting}
              onClick={() => setConfirmDelete(false)}
            >
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={() => void remove()}
            >
              {deleting ? <Spinner /> : t("delete")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <ShareToDialog
        postId={post.id}
        open={shareOpen}
        onOpenChange={setShareOpen}
      />
    </article>
  );
}
