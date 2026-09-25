"use client";

import { useEffect, useRef, useState } from "react";

import type { FeedPage } from "@/interfaces/post.interface";
import { useLazyFeedPageQuery } from "@/store/api";
import { Button } from "../ui/button";
import { Spinner } from "../ui/spinner";
import FeedPost from "./feed-post";
import { CAROUSEL_STEP_EVENT } from "./post-media";

const scrollBehavior = (): ScrollBehavior =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

/** One post per viewport, snapping; J/K step between them, pages load ahead. */
export default function FeedStream({ initial }: { initial: FeedPage }) {
  const [posts, setPosts] = useState(initial.posts);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [fetchPage, { isFetching, isError }] = useLazyFeedPageQuery();
  const scroller = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);

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
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      const el = scroller.current;
      if (!el) return;
      const key = event.key.toLowerCase();
      if (key === "j" || key === "k") {
        event.preventDefault();
        el.scrollBy({
          top: key === "j" ? el.clientHeight : -el.clientHeight,
          behavior: scrollBehavior(),
        });
      } else if (key === "arrowleft" || key === "arrowright") {
        // Every frame is exactly one scroller-height tall, so this is the snapped post.
        const current = el.querySelectorAll("article")[Math.round(el.scrollTop / el.clientHeight)];
        if (!current) return;
        event.preventDefault();
        current.dispatchEvent(
          new CustomEvent(CAROUSEL_STEP_EVENT, { detail: key === "arrowright" ? 1 : -1 }),
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
      aria-label="Posts"
      className="h-[calc(100svh-3.5rem-env(safe-area-inset-bottom))] snap-y snap-mandatory overflow-y-auto overscroll-contain focus-visible:outline-none md:h-svh"
    >
      {posts.map((post, i) => (
        <FeedPost key={post.id} post={post} priority={i === 0} />
      ))}

      <div
        ref={sentinel}
        className="flex h-full snap-start flex-col items-center justify-center gap-4 px-6 text-center"
      >
        {cursor ? (
          isError ? (
            <>
              <p className="text-sm text-muted-foreground">
                Couldn&apos;t load more posts.
              </p>
              <Button variant="outline" onClick={() => void loadMore()}>
                Try again
              </Button>
            </>
          ) : (
            <Spinner className="size-6 text-muted-foreground" aria-label="Loading more posts" />
          )
        ) : (
          <>
            <p className="text-lg font-semibold">You&apos;re all caught up</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              That&apos;s everything from the people you follow.
            </p>
            <Button
              variant="ghost"
              onClick={() =>
                scroller.current?.scrollTo({ top: 0, behavior: scrollBehavior() })
              }
            >
              Back to the newest
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
