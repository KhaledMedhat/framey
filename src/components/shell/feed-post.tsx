"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Comment, Heart } from "reicon-react";

import type { FeedPost as FeedPostData } from "@/interfaces/post.interface";
import { cn, getFullName } from "@/lib/utils";
import { useSetLikeMutation } from "@/store/api";
import { toast } from "../ui/toast";
import PostMedia from "./post-media";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";

const DEFAULT_RATIO = 4 / 5;
const LONG_CAPTION = 140;

/** "now", "12m", "5h", "3d", "2w", then a date: the feed's time scale. */
function timeAgo(iso: string) {
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000;
  if (seconds < 60) return "now";
  const steps: [number, string][] = [
    [60, "m"],
    [24, "h"],
    [7, "d"],
    [5, "w"],
  ];
  let value = seconds / 60;
  for (const [size, unit] of steps) {
    if (value < size) return `${Math.floor(value)}${unit}`;
    value /= size;
  }
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

const plural = (n: number, word: string) =>
  `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;

export default function FeedPost({
  post,
  priority,
}: {
  post: FeedPostData;
  priority: boolean;
}) {
  const [like, setLikeState] = useState({
    liked: post.likedByMe,
    count: post.likeCount,
  });
  const [expanded, setExpanded] = useState(false);
  const [setLike] = useSetLikeMutation();
  // Only the newest request may settle the state; older responses are stale.
  const latest = useRef(0);

  const first = post.media[0];
  const ratio =
    first?.width && first.height ? first.width / first.height : DEFAULT_RATIO;
  const name = getFullName(post.author.firstName, post.author.lastName);
  const isLong = (post.caption?.length ?? 0) > LONG_CAPTION;
  // Landscape media would leave most of a desktop frame empty beside a text
  // column, so it stacks instead: media across the stage, text in a strip below.
  const landscape = ratio > 1;
  // Glyph over count in the portrait column; side by side everywhere else.
  const glyphItem = cn(
    "flex items-center gap-2",
    !landscape && "md:flex-col md:gap-1",
  );

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
        description: "Couldn't update your like. Try again.",
      });
    } else {
      setLikeState({ liked: result.data.liked, count: result.data.likeCount });
    }
  };

  const likeButton = (
    <button
      type="button"
      aria-pressed={like.liked}
      aria-label={like.liked ? "Unlike" : "Like"}
      onClick={() => toggleLike(!like.liked)}
      className="-m-2 rounded-full p-2 transition-transform duration-150 active:scale-90 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none"
    >
      <Heart
        aria-hidden
        weight={like.liked ? "Filled" : "Outline"}
        className="size-7"
      />
    </button>
  );

  const likeCount = !post.hidePostInfo && (
    <span className="text-sm font-medium tabular-nums" aria-live="polite">
      <span className="sr-only">{plural(like.count, "like")}</span>
      <span aria-hidden>{like.count.toLocaleString()}</span>
    </span>
  );

  // Counts only for now: there is no post page to open comments on yet.
  const comments = !post.hideComments && (
    <span className={glyphItem}>
      <Comment className="size-7" aria-hidden />
      <span className="text-sm font-medium tabular-nums">
        <span className="sr-only">{plural(post.commentCount, "comment")}</span>
        <span aria-hidden>{post.commentCount.toLocaleString()}</span>
      </span>
    </span>
  );

  const author = (
    <>
      <div className="flex items-center gap-2.5">
        <Link
          href={`/${post.author.username}`}
          className="rounded-full focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          tabIndex={-1}
          aria-hidden
        >
          <Avatar size="sm">
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
            title={new Date(post.createdAt).toLocaleString()}
            className="shrink-0 text-muted-foreground"
            suppressHydrationWarning
          >
            {timeAgo(post.createdAt)}
          </time>
        </div>
      </div>
      {post.location && (
        <p className="text-xs text-muted-foreground">{post.location}</p>
      )}
    </>
  );

  return (
    <article
      aria-label={`Post by ${post.author.username}`}
      className="flex h-full snap-start snap-always flex-col md:flex-row md:items-center md:justify-center md:px-8 md:py-6"
    >
      {/* Mobile: who posted sits above the media, where feeds taught everyone to look. */}
      <header className="flex flex-col gap-1 px-4 pt-3 pb-3 md:hidden">
        {author}
      </header>

      <div
        style={{ "--ratio": ratio } as React.CSSProperties}
        className={cn(
          "flex flex-col",
          landscape
            ? // 12rem = the frame's 3rem padding + a 9rem strip for the text.
              "md:w-[min(100%,calc((100svh-12rem)*var(--ratio)))] md:gap-4"
            : // As tall as the media, so the column ends where the media ends.
              "md:w-full md:flex-row md:items-end md:justify-center md:gap-8",
        )}
      >
        <div
          className={cn(
            "w-full",
            // Portrait/square: as tall as the frame allows, width from the ratio.
            !landscape &&
              "md:w-[calc((100svh-3rem)*var(--ratio))] md:max-w-full md:min-w-0 md:shrink",
          )}
        >
          <div className="mx-auto max-w-[calc(60svh*var(--ratio))] md:max-w-none">
            <PostMedia
              media={post.media}
              ratio={ratio}
              priority={priority}
              onDoubleTap={() => toggleLike(true)}
            />
          </div>
        </div>

        <div
          className={cn(
            "flex shrink-0 flex-col gap-3 px-4 pt-3 md:px-0 md:pt-0",
            landscape
              ? "md:flex-row-reverse md:items-start md:justify-between md:gap-8"
              : "md:w-60 md:gap-6",
          )}
        >
          <div
            className={cn(
              "flex items-center gap-5",
              !landscape && "md:flex-col md:items-start",
            )}
          >
            <span className={glyphItem}>
              {likeButton}
              {likeCount}
            </span>
            {comments}
          </div>

          <div
            className={cn(
              "flex min-h-0 min-w-0 flex-col gap-2",
              landscape ? "md:max-w-xl" : "md:border-t md:pt-5",
            )}
          >
            <div className="hidden flex-col gap-2 md:flex">{author}</div>
            {post.caption && (
              <div className="min-h-0 overflow-y-auto text-sm leading-relaxed text-pretty">
                <p
                  className={cn(
                    "whitespace-pre-line",
                    !expanded &&
                      (landscape
                        ? "line-clamp-3 md:line-clamp-2"
                        : "line-clamp-3 md:line-clamp-6"),
                  )}
                >
                  {post.caption}
                </p>
                {isLong && !expanded && (
                  <button
                    type="button"
                    onClick={() => setExpanded(true)}
                    className="text-muted-foreground hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
                  >
                    more
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
