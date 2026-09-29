"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Archive,
  ArchiveSlash,
  ArrowRight,
  Comment,
  Heart,
  Link2,
  MoreH,
  Repeat3,
  Send,
  Trash,
  UserAdd,
  UserMinus,
} from "reicon-react";

import type { FeedPost as FeedPostData } from "@/interfaces/post.interface";
import { cn, getFullName, timeAgo } from "@/lib/utils";
import {
  useArchivePostMutation,
  useDeletePostMutation,
  useSetFollowMutation,
  useSetLikeMutation,
  useSetRepostMutation,
  type ApiError,
} from "@/store/api";
import { useLang, useT } from "../i18n-provider";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Spinner } from "../ui/spinner";
import { toast } from "../ui/toast";
import { CommentBox, CommentList, type CommentReply } from "./comments";
import Mentions from "./mentions";
import PostMedia from "./post-media";
import SavePost from "./save-post";
import { ShareToDialog } from "./share-to";
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

/** The tallest a post frame gets, like Instagram; taller media letterbox. */
const FRAME_RATIO = 4 / 5;

/**
 * The feed frame's ratio: the first media's own shape, so the height follows
 * the image. Capped at 4:5 tall so one post can't fill the screen; a taller
 * photo letterboxes at the sides.
 */
const mediaRatio = ([first]: FeedPostData["media"]) =>
  first?.width && first.height
    ? Math.max(FRAME_RATIO, first.width / first.height)
    : FRAME_RATIO;
const LONG_CAPTION = 140;

export default function FeedPost({
  post,
  priority,
  layout = "feed",
  onOpen,
}: {
  post: FeedPostData;
  priority: boolean;
  /** "modal": Instagram's post window (media left, panel right), used when a post opens from a profile grid or the feed. */
  layout?: "feed" | "modal";
  /** Feed only: opens the post's full view (a tap on the media, Show all comments). */
  onOpen?: () => void;
}) {
  const [like, setLikeState] = useState({
    liked: post.likedByMe,
    count: post.likeCount,
  });
  const [expanded, setExpanded] = useState(false);
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [reply, setReply] = useState<CommentReply | null>(null);
  const commentInput = useRef<HTMLTextAreaElement>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  // Archived or deleted from this view: it leaves the list right away.
  const [gone, setGone] = useState(false);
  const [setLike] = useSetLikeMutation();
  const [repost, setRepostState] = useState({
    reposted: post.repostedByMe,
    count: post.repostCount,
  });
  const [setRepost] = useSetRepostMutation();
  const [follow, setFollowState] = useState<"none" | "following" | "requested">(
    post.followingAuthor ? "following" : "none",
  );
  const [setFollow] = useSetFollowMutation();
  const [archivePost] = useArchivePostMutation();
  const [deletePost, { isLoading: deleting }] = useDeletePostMutation();
  const router = useRouter();
  const t = useT();
  const lang = useLang();
  const { data: session } = useSession();
  const isMine = session?.user?.id === post.author.id;
  // Only the newest request may settle the state; older responses are stale.
  const latest = useRef(0);

  const name = getFullName(post.author.firstName, post.author.lastName);
  const isLong = (post.caption?.length ?? 0) > LONG_CAPTION;

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

  // Optimistic like the heart: flip now, settle on the server's answer.
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

  const toggleFollow = async () => {
    const before = follow;
    const following = follow === "none";
    setFollowState(following ? "following" : "none");
    const result = await setFollow({
      username: post.author.username,
      following,
    });
    if ("error" in result) {
      setFollowState(before);
      toast.add({
        type: "error",
        description:
          (result.error as ApiError).data?.message ?? t("somethingWrong"),
      });
      return;
    }
    setFollowState(
      result.data.following
        ? "following"
        : result.data.requested
          ? "requested"
          : "none",
    );
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${location.origin}/p/${post.id}`);
      toast.add({ description: t("linkCopied") });
    } catch {
      toast.add({ type: "error", description: t("copyLinkFailed") });
    }
  };

  const archive = async () => {
    const result = await archivePost({
      postId: post.id,
      archived: !post.archived,
    });
    if ("error" in result) {
      toast.add({
        type: "error",
        description:
          (result.error as ApiError).data?.message ?? t("postUpdateFailed"),
      });
      return;
    }
    toast.add({
      description: post.archived ? t("postRestored") : t("postArchived"),
    });
    setGone(true);
    router.refresh();
  };

  const remove = async () => {
    const result = await deletePost(post.id);
    if ("error" in result) {
      toast.add({
        type: "error",
        description: t("postDeleteFailed"),
      });
      return;
    }
    setConfirmDelete(false);
    setGone(true);
    router.refresh();
  };

  const author = (
    <>
      <div className="flex items-center gap-2.5">
        <Link
          href={`/${post.author.username}`}
          className="rounded-full focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          tabIndex={-1}
          aria-hidden
        >
          <Avatar>
            <AvatarImage
              src={post.author.profilePicture?.url}
              alt={post.author.username}
            />
            <AvatarFallback className="bg-muted text-muted-foreground">
              {post.author.username.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </Link>
        <div className="flex min-w-0 items-baseline gap-2 text-sm">
          <Link
            href={`/${post.author.username}`}
            title={name}
            className="truncate font-semibold hover:underline hover:underline-offset-4 focus-visible:underline focus-visible:outline-none"
          >
            {post.author.username}
          </Link>
          <time
            dateTime={post.createdAt}
            title={new Date(post.createdAt).toLocaleString(lang)}
            className="shrink-0 text-muted-foreground"
            suppressHydrationWarning
          >
            {timeAgo(post.createdAt, lang, t("timeNow"))}
          </time>
        </div>
        {session?.user && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("postOptions")}
                  className="ms-auto"
                >
                  <MoreH aria-hidden size={20} weight="Filled" />
                </Button>
              }
            ></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 p-1.5">
              <DropdownMenuItem
                className="h-10 gap-3 px-3"
                render={<Link href={`/p/${post.id}`} />}
              >
                <ArrowRight
                  aria-hidden
                  size={20}
                  className="rtl:rotate-180"
                />
                {t("goToPost")}
              </DropdownMenuItem>
              {!isMine && (
                <DropdownMenuItem
                  variant={follow === "none" ? "default" : "destructive"}
                  onClick={() => void toggleFollow()}
                  className="h-10 gap-3 px-3"
                >
                  {follow === "none" ? (
                    <UserAdd aria-hidden size={20} />
                  ) : (
                    <UserMinus aria-hidden size={20} />
                  )}
                  {follow === "following"
                    ? t("unfollow")
                    : follow === "requested"
                      ? t("withdrawRequest")
                      : t("follow")}
                </DropdownMenuItem>
              )}
              {/* An archived post is only visible to its author: nothing to share. */}
              {!post.archived && (
                <>
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
                    <Link2 aria-hidden size={20} />
                    {t("copyLink")}
                  </DropdownMenuItem>
                </>
              )}
              {isMine && (
                <DropdownMenuItem
                  onClick={() => void archive()}
                  className="h-10 gap-3 px-3"
                >
                  {post.archived ? (
                    <ArchiveSlash aria-hidden size={20} />
                  ) : (
                    <Archive aria-hidden size={20} />
                  )}
                  {post.archived ? t("showOnProfile") : t("archive")}
                </DropdownMenuItem>
              )}
              {isMine && (
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setConfirmDelete(true)}
                  className="h-10 gap-3 px-3"
                >
                  <Trash aria-hidden size={20} />
                  {t("delete")}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {post.location &&
        (post.locationId ? (
          <Link
            href={`/locations/${post.locationId}`}
            className="self-start rounded-sm mt-0.5 text-xs text-foreground underline-offset-4 transition-colors duration-150 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none"
          >
            {post.location}
          </Link>
        ) : (
          <p className="text-xs text-muted-foreground">{post.location}</p>
        ))}
    </>
  );

  if (gone) return null;

  return (
    <>
      {layout === "modal" ? (
        <article
          aria-label={t("postBy", { name: post.author.username })}
          style={{ "--media-ratio": mediaRatio(post.media) } as React.CSSProperties}
          className="mx-auto flex w-full flex-col overflow-hidden bg-card md:h-[min(88svh,56rem)] md:w-fit md:flex-row md:rounded-lg md:border"
        >
          {/* The window is always full height. The photo takes that height at
              its own shape; one too wide for the screen (the screen less the
              26rem panel, the rail and margins) fits the width instead and
              sits centred with black above and below. */}
          <div
            className="flex items-center justify-center bg-black md:h-full md:w-[min(calc(min(88svh,56rem)*var(--media-ratio)),calc(100vw_-_34rem))] md:shrink-0"
            style={{ aspectRatio: mediaRatio(post.media) }}
          >
            <div className="w-full">
              <PostMedia
                media={post.media}
                tags={post.tags}
                ratio={mediaRatio(post.media)}
                priority={priority}
                onDoubleTap={() => toggleLike(true)}
              />
            </div>
          </div>
          <div className="flex min-h-0 flex-col md:w-[26rem] md:border-s">
            <div className="flex flex-col gap-0.5 border-b px-4 py-3">
              {author}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 text-sm leading-relaxed">
              {post.caption ? (
                <div className="flex gap-3">
                  <Avatar size="sm" className="mt-0.5">
                    <AvatarImage src={post.author.profilePicture?.url} alt="" />
                    <AvatarFallback>
                      {post.author.username.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="break-words whitespace-pre-line text-pretty">
                      <Link
                        href={`/${post.author.username}`}
                        className="me-1.5 font-semibold hover:opacity-70"
                      >
                        {post.author.username}
                      </Link>
                      <Mentions text={post.caption} />
                    </p>
                    <time
                      dateTime={post.createdAt}
                      className="mt-1 block text-xs text-muted-foreground"
                      suppressHydrationWarning
                    >
                      {timeAgo(post.createdAt, lang, t("timeNow"))}
                    </time>
                  </div>
                </div>
              ) : null}
              {!post.hideComments && (
                <div className={cn(post.caption && "mt-5")}>
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
              )}
            </div>
            <div className="flex flex-col gap-1.5 border-t px-3 pt-2 pb-3">
              <div className="flex items-center">
                <span className="flex items-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-pressed={like.liked}
                    aria-label={like.liked ? t("unlike") : t("like")}
                    onClick={() => toggleLike(!like.liked)}
                    className="active:scale-90"
                  >
                    <Heart
                      aria-hidden
                      weight={like.liked ? "Filled" : "Outline"}
                      className={cn("size-6", like.liked && "text-destructive")}
                    />
                  </Button>
                  {(!post.hidePostInfo || isMine) && (
                    <span
                      className="text-sm font-semibold tabular-nums"
                      aria-live="polite"
                    >
                      <span className="sr-only">
                        {t(like.count === 1 ? "oneLike" : "nLikes", {
                          n: like.count.toLocaleString(lang),
                        })}
                      </span>
                      <span aria-hidden>{like.count.toLocaleString()}</span>
                    </span>
                  )}
                </span>
                {!post.hideComments && (
                  <span className="flex items-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t("comment")}
                      onClick={() => commentInput.current?.focus()}
                      className="active:scale-90"
                    >
                      <Comment aria-hidden className="size-6" />
                    </Button>
                    <span className="text-sm font-semibold tabular-nums">
                      <span className="sr-only">
                        {t(commentCount === 1 ? "oneComment" : "nComments", {
                          n: commentCount.toLocaleString(lang),
                        })}
                      </span>
                      <span aria-hidden>{commentCount.toLocaleString()}</span>
                    </span>
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("shareTo")}
                  onClick={() => setShareOpen(true)}
                  className="active:scale-90"
                >
                  <Send aria-hidden className="size-6" />
                </Button>
                {!isMine && (
                  <span className="flex items-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-pressed={repost.reposted}
                      aria-label={
                        repost.reposted ? t("undoRepost") : t("repost")
                      }
                      onClick={() => void toggleRepost()}
                      className="active:scale-90"
                    >
                      <Repeat3
                        aria-hidden
                        className={cn(
                          "size-6",
                          repost.reposted && "text-emerald-500",
                        )}
                      />
                    </Button>
                    {repost.count > 0 && (
                      <span className="text-sm font-semibold tabular-nums">
                        {repost.count.toLocaleString(lang)}
                      </span>
                    )}
                  </span>
                )}
                <SavePost
                  postId={post.id}
                  saved={post.savedByMe}
                  className="ms-auto"
                />
              </div>
              <time
                dateTime={post.createdAt}
                className="px-1 text-[0.6875rem] tracking-wide text-muted-foreground uppercase"
                suppressHydrationWarning
              >
                {new Date(post.createdAt).toLocaleDateString(lang, {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </time>
            </div>
            {!post.hideComments && (
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
            )}
          </div>
        </article>
      ) : (
        <article
          aria-label={t("postBy", { name: post.author.username })}
          className="mx-auto flex w-[min(100%,30rem)] flex-col border-b pb-5"
        >
          <div className="flex flex-col gap-0.5 px-4 py-3 md:px-1">
            {author}
          </div>
          <div className="relative overflow-hidden md:rounded-sm">
            <PostMedia
              media={post.media}
              tags={post.tags}
              ratio={mediaRatio(post.media)}
              priority={priority}
              onDoubleTap={() => toggleLike(true)}
              onTap={onOpen}
            />
            {/* Instagram's repost pill: slides up over the photo's foot, and
                again each time you repost it here. */}
            {(repost.reposted || post.repostedBy) && (
              <Link
                key={repost.reposted ? "you" : "them"}
                href={`/${repost.reposted ? session?.user?.username : post.repostedBy!.username}`}
                className="absolute start-3 bottom-3 z-10 flex h-8 items-center gap-1.5 rounded-full bg-background/80 ps-1 pe-3 text-xs font-semibold text-foreground shadow-sm backdrop-blur-sm duration-300 animate-in fade-in slide-in-from-bottom-3 motion-reduce:animate-none"
              >
                <Avatar size="sm">
                  <AvatarImage
                    src={
                      (repost.reposted
                        ? session?.user?.profilePicture
                        : post.repostedBy?.profilePicture
                      )?.url
                    }
                    alt=""
                  />
                  <AvatarFallback>
                    {(repost.reposted
                      ? (session?.user?.username ?? "")
                      : post.repostedBy!.username
                    )
                      .slice(0, 2)
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <Repeat3 aria-hidden className="size-3.5" />
                {repost.reposted
                  ? t("youReposted")
                  : t("userReposted", { name: post.repostedBy!.username })}
              </Link>
            )}
          </div>
          <div className="flex flex-col gap-2 px-4 pt-3 md:px-1">
            <div className="-mx-2 flex items-center">
              <span className="flex items-center">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-pressed={like.liked}
                  aria-label={like.liked ? t("unlike") : t("like")}
                  onClick={() => toggleLike(!like.liked)}
                  className="active:scale-90 motion-reduce:transition-none hover:scale-105 hover:bg-transparent!"
                >
                  <Heart
                    aria-hidden
                    weight={like.liked ? "Filled" : "Outline"}
                    size={24}
                    className={cn(like.liked && "text-destructive")}
                  />
                </Button>
                {(!post.hidePostInfo || isMine) && (
                  <span
                    className="text-sm font-semibold tabular-nums"
                    aria-live="polite"
                  >
                    <span className="sr-only">
                      {t(like.count === 1 ? "oneLike" : "nLikes", {
                        n: like.count.toLocaleString(lang),
                      })}
                    </span>
                    <span aria-hidden>{like.count.toLocaleString()}</span>
                  </span>
                )}
              </span>
              {!post.hideComments && (
                <span className="flex items-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t("comment")}
                    onClick={() => commentInput.current?.focus()}
                    className="active:scale-90 motion-reduce:transition-none hover:scale-105 hover:bg-transparent!"
                  >
                    <Comment aria-hidden size={22} />
                  </Button>
                  <span className="text-sm font-semibold tabular-nums">
                    <span className="sr-only">
                      {t(commentCount === 1 ? "oneComment" : "nComments", {
                        n: commentCount.toLocaleString(lang),
                      })}
                    </span>
                    <span aria-hidden>{commentCount.toLocaleString()}</span>
                  </span>
                </span>
              )}
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("shareTo")}
                onClick={() => setShareOpen(true)}
                className="active:scale-90 motion-reduce:transition-none hover:scale-105 hover:bg-transparent!"
              >
                <Send aria-hidden size={22} />
              </Button>
              {!isMine && (
                <span className="flex items-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-pressed={repost.reposted}
                    aria-label={repost.reposted ? t("undoRepost") : t("repost")}
                    onClick={() => void toggleRepost()}
                    className="active:scale-90 motion-reduce:transition-none hover:scale-105 hover:bg-transparent!"
                  >
                    <Repeat3
                      aria-hidden
                      size={22}
                      className={cn(repost.reposted && "text-emerald-500")}
                    />
                  </Button>
                  {repost.count > 0 && (
                    <span className="text-sm font-semibold tabular-nums">
                      {repost.count.toLocaleString(lang)}
                    </span>
                  )}
                </span>
              )}
              <SavePost
                postId={post.id}
                saved={post.savedByMe}
                className="ms-auto"
              />
            </div>
            {post.caption && (
              <div className="text-sm leading-snug text-pretty">
                <p
                  className={cn(
                    "whitespace-pre-line",
                    !expanded && "line-clamp-2",
                  )}
                >
                  <Link
                    href={`/${post.author.username}`}
                    className="me-1.5 font-semibold hover:opacity-70"
                  >
                    {post.author.username}
                  </Link>
                  <Mentions text={post.caption} />
                </p>
                {isLong && !expanded && (
                  <Button
                    variant="link"
                    onClick={() => setExpanded(true)}
                    className="h-auto p-0 font-normal text-muted-foreground hover:text-foreground hover:no-underline"
                  >
                    {t("more").toLowerCase()}
                  </Button>
                )}
              </div>
            )}
            {!post.hideComments && (
              <>
                <CommentList
                  postId={post.id}
                  preview
                  onReply={(next) => {
                    setReply(next);
                    commentInput.current?.focus();
                  }}
                  onCountChange={(delta) =>
                    setCommentCount((n) => Math.max(0, n + delta))
                  }
                />
                {commentCount > 0 && onOpen && (
                  <Button
                    variant="link"
                    onClick={onOpen}
                    className="h-auto self-start p-0 font-normal text-muted-foreground hover:text-foreground"
                  >
                    {t("showAllComments", {
                      n: commentCount.toLocaleString(lang),
                    })}
                  </Button>
                )}
                <CommentBox
                  postId={post.id}
                  reply={reply}
                  inputRef={commentInput}
                  onCancelReply={() => setReply(null)}
                  onPosted={() => {
                    setReply(null);
                    setCommentCount((n) => n + 1);
                  }}
                />
              </>
            )}
          </div>
        </article>
      )}
      <AlertDialog
        open={confirmDelete}
        onOpenChange={(open) => !deleting && setConfirmDelete(open)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deletePostTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deletePostBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              variant="destructive"
              onClick={() => void remove()}
            >
              {deleting ? <Spinner /> : t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ShareToDialog
        postId={post.id}
        open={shareOpen}
        onOpenChange={setShareOpen}
      />
    </>
  );
}
