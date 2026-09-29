"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import {
  ChevronLeft,
  ChevronRight,
  Comment,
  Copy,
  Heart,
  VideoPlay,
  X,
} from "reicon-react";

import type { FeedPost as FeedPostData } from "@/interfaces/post.interface";
import { isVideoType } from "@/lib/files";
import { cn } from "@/lib/utils";
import { useLang, useT } from "../i18n-provider";
import { Button } from "../ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "../ui/dialog";
import FeedPost from "./feed-post";
import { CAROUSEL_STEP_EVENT } from "./post-media";

/** Floating controls on media: the one place pills and shadow are allowed. */
const pill =
  "rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur-sm";

/**
 * The profile's contact sheet: square tiles, and a full-frame viewer that
 * steps through them with J/K (or the side pills) and through a carousel
 * with ← / →, like the feed.
 */
export default function ProfileGrid({
  posts,
  className,
  onOpenChange,
}: {
  posts: FeedPostData[];
  className?: string;
  /** Told when the post viewer opens or closes (the hover card stays up meanwhile). */
  onOpenChange?: (open: boolean) => void;
}) {
  const t = useT();
  const lang = useLang();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const viewerId = useSession().data?.user?.id;
  const open = openIndex === null ? null : posts[openIndex];
  useEffect(() => onOpenChange?.(open !== null), [open, onOpenChange]);
  const step = (by: number) =>
    setOpenIndex((i) =>
      i === null ? i : Math.min(posts.length - 1, Math.max(0, i + by)),
    );

  return (
    <>
      <h2 className="sr-only">{t("postsLabel")}</h2>
      <ul
        className={cn(
          "grid grid-cols-3 gap-0.5 md:grid-cols-4 md:gap-1 lg:grid-cols-5 xl:grid-cols-6",
          className,
        )}
      >
        {posts.map((post, i) => {
          const first = post.media[0];
          const video = isVideoType(first?.type);
          const src = video ? first?.cover?.url : first?.url;
          return (
            <li key={post.id}>
              <Button
                variant="ghost"
                onClick={() => setOpenIndex(i)}
                aria-label={`${t("openPost")}${post.caption ? `: ${post.caption.slice(0, 80)}` : ""}`}
                className="group relative block aspect-4/5 h-auto w-full overflow-hidden rounded-none border-0 bg-muted p-0 hover:bg-muted focus-visible:ring-0"
              >
                {src && (
                  <Image
                    src={src}
                    alt={first?.alt ?? ""}
                    fill
                    sizes="(min-width: 1280px) 17vw, (min-width: 768px) 25vw, 33vw"
                    quality={90}
                    priority={i < 6}
                    className="object-cover"
                  />
                )}
                {(post.media.length > 1 || video) && (
                  <span className="pointer-events-none absolute end-2 top-2 text-white drop-shadow-sm">
                    {post.media.length > 1 ? (
                      <Copy aria-label={t("carousel")} className="size-5" />
                    ) : (
                      <VideoPlay
                        aria-label={t("video")}
                        weight="Filled"
                        className="size-5"
                      />
                    )}
                  </span>
                )}
                {/* The veil states the counts the tile hides; focus shows it too. */}
                <span className="absolute inset-0 flex items-center justify-center gap-6 bg-background/55 text-sm font-semibold text-foreground opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none">
                  {(!post.hidePostInfo || post.author.id === viewerId) && (
                    <span className="flex items-center gap-1.5 tabular-nums">
                      <Heart aria-hidden weight="Filled" className="size-5" />
                      {post.likeCount.toLocaleString(lang)}
                      <span className="sr-only">{t("likesLabel")}</span>
                    </span>
                  )}
                  {!post.hideComments && (
                    <span className="flex items-center gap-1.5 tabular-nums">
                      <Comment aria-hidden weight="Filled" className="size-5" />
                      {post.commentCount.toLocaleString(lang)}
                      <span className="sr-only">{t("commentsLabel")}</span>
                    </span>
                  )}
                </span>
                <span className="pointer-events-none absolute inset-0 ring-foreground ring-inset group-focus-visible:ring-2" />
              </Button>
            </li>
          );
        })}
      </ul>

      <Dialog
        open={open !== null}
        onOpenChange={(next) => !next && setOpenIndex(null)}
      >
        <DialogContent
          onKeyDown={(event) => {
            if (event.target instanceof HTMLInputElement) return;
            const key = event.key.toLowerCase();
            if (key === "j") step(1);
            else if (key === "k") step(-1);
            else if (key === "arrowleft" || key === "arrowright") {
              event.currentTarget.querySelector("article")?.dispatchEvent(
                new CustomEvent(CAROUSEL_STEP_EVENT, {
                  detail: key === "arrowright" ? 1 : -1,
                }),
              );
            } else return;
            event.preventDefault();
          }}
          className="inset-0 top-0 left-0 h-svh w-full max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-none bg-background px-0 py-12 sm:max-w-none md:grid md:place-items-center md:px-16"
        >
          {open && (
            <>
              <DialogTitle className="sr-only">
                {t("postBy", { name: open.author.username })}
              </DialogTitle>
              <FeedPost key={open.id} post={open} priority layout="modal" />
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
              {openIndex! > 0 && (
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label={t("previousPost")}
                  onClick={() => step(-1)}
                  className={`${pill} fixed top-1/2 left-3 hidden -translate-y-1/2 md:flex`}
                >
                  <ChevronLeft aria-hidden className="size-5" />
                </Button>
              )}
              {openIndex! < posts.length - 1 && (
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label={t("nextPost")}
                  onClick={() => step(1)}
                  className={`${pill} fixed top-1/2 right-3 hidden -translate-y-1/2 md:flex`}
                >
                  <ChevronRight aria-hidden className="size-5" />
                </Button>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
