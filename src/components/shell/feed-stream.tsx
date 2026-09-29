"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { X } from "reicon-react";

import type {
  FeedPage,
  FeedPost as FeedPostData,
} from "@/interfaces/post.interface";
import { isVideoType } from "@/lib/files";
import { useLazyFeedPageQuery } from "@/store/api";
import { useT } from "../i18n-provider";
import { Button } from "../ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "../ui/dialog";
import { Spinner } from "../ui/spinner";
import FeedPost from "./feed-post";
import { CAROUSEL_STEP_EVENT } from "./post-media";

const scrollBehavior = (): ScrollBehavior =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

const isVideoPost = (post: FeedPostData) => isVideoType(post.media[0]?.type);

/** Posts in one scrolling column; J/K step between them, pages load ahead. */
export default function FeedStream({ initial }: { initial: FeedPage }) {
  const [posts, setPosts] = useState(initial.posts);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [fetchPage, { isFetching, isError }] = useLazyFeedPageQuery();
  const scroller = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  // A photo opens in the post viewer like on a profile; a video opens its reel page.
  const [open, setOpen] = useState<FeedPostData | null>(null);
  const router = useRouter();
  const t = useT();

  const loadMore = async () => {
    if (!cursor || isFetching) return;
    const { data } = await fetchPage(cursor);
    if (!data) return;
    setPosts((current) => {
      const seen = new Set(current.map((p) => p.id));
      return [...current, ...data.posts.filter((p) => !seen.has(p.id))];
    });
    setCursor(data.nextCursor);
  };

  // Start fetching while the viewer is still two frames away from the end.
  useEffect(() => {
    const root = scroller.current;
    const target = sentinel.current;
    if (!root || !target || !cursor || isError) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) void loadMore();
      },
      { root, rootMargin: "0px 0px 200% 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isTyping(event.target)
      )
        return;
      // The post viewer scrolls itself.
      if (document.querySelector('[data-slot="dialog-content"]')) return;
      const el = scroller.current;
      if (!el) return;
      const key = event.key.toLowerCase();
      const posts = [...el.querySelectorAll("article")];
      const top = el.getBoundingClientRect().top;
      // The post whose top is nearest the scroller's top is the current one.
      const current = posts.reduce<{ i: number; d: number }>(
        (best, post, i) => {
          const d = Math.abs(post.getBoundingClientRect().top - top);
          return d < best.d ? { i, d } : best;
        },
        { i: 0, d: Infinity },
      ).i;
      if (key === "j" || key === "k") {
        event.preventDefault();
        posts[current + (key === "j" ? 1 : -1)]?.scrollIntoView({
          block: "start",
          behavior: scrollBehavior(),
        });
      } else if (key === "arrowleft" || key === "arrowright") {
        const post = posts[current];
        if (!post) return;
        event.preventDefault();
        post.dispatchEvent(
          new CustomEvent(CAROUSEL_STEP_EVENT, {
            detail: key === "arrowright" ? 1 : -1,
          }),
        );
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      ref={scroller}
      tabIndex={0}
      aria-label={t("postsLabel")}
      className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain py-2 focus-visible:outline-none md:gap-6 md:py-6"
    >
      {posts.map((post, i) => (
        <FeedPost
          key={post.id}
          post={post}
          priority={i === 0}
          onOpen={() =>
            isVideoPost(post) ? router.push(`/reels/${post.id}`) : setOpen(post)
          }
        />
      ))}

      <Dialog open={!!open} onOpenChange={(next) => !next && setOpen(null)}>
        <DialogContent className="inset-0 top-0 left-0 h-svh w-full max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-none bg-background px-0 py-12 sm:max-w-none md:grid md:place-items-center md:px-16">
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
            </>
          )}
        </DialogContent>
      </Dialog>

      <div
        ref={sentinel}
        className="flex min-h-48 flex-col items-center justify-center gap-4 px-6 py-10 text-center"
      >
        {cursor ? (
          isError ? (
            <>
              <p className="text-sm text-muted-foreground">
                {t("loadMoreFailed")}
              </p>
              <Button variant="outline" onClick={() => void loadMore()}>
                {t("tryAgain")}
              </Button>
            </>
          ) : (
            <Spinner
              className="size-6 text-muted-foreground"
              aria-label={t("loadingMorePosts")}
            />
          )
        ) : (
          <>
            <p className="text-lg font-semibold">{t("allCaughtUp")}</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              {t("allCaughtUpBody")}
            </p>
            <Button
              variant="ghost"
              onClick={() =>
                scroller.current?.scrollTo({
                  top: 0,
                  behavior: scrollBehavior(),
                })
              }
            >
              {t("backToNewest")}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
