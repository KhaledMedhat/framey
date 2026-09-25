"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, Heart, Play, VolumeCross, VolumeHigh } from "reicon-react";

import type { FeedMedia } from "@/interfaces/post.interface";
import { isVideoType } from "@/lib/files";
import { cn } from "@/lib/utils";

const DOUBLE_TAP_MS = 280;

/** Dispatched on a post's <article> to step its carousel (see feed-stream.tsx). */
export const CAROUSEL_STEP_EVENT = "framey:carousel-step";

/** Floating controls on media: the one place pills and shadow are allowed. */
const pill =
  "rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur-sm";

/**
 * The post's frame: every slide shares the first media's ratio, square
 * corners, and the room's black behind anything letterboxed.
 */
export default function PostMedia({
  media,
  ratio,
  priority,
  onDoubleTap,
}: {
  media: FeedMedia[];
  ratio: number;
  priority: boolean;
  onDoubleTap: () => void;
}) {
  const [emblaRef, embla] = useEmblaCarousel({ watchDrag: media.length > 1 });
  const [index, setIndex] = useState(0);
  const [videoPaused, setVideoPaused] = useState(false);
  const [blooms, setBlooms] = useState<{ id: number; x: number; y: number }[]>([]);
  const lastTap = useRef(0);
  const singleTap = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!embla) return;
    const onSelect = () => {
      setIndex(embla.selectedScrollSnap());
      setVideoPaused(false);
    };
    embla.on("select", onSelect);
    return () => {
      embla.off("select", onSelect);
    };
  }, [embla]);

  useEffect(() => () => clearTimeout(singleTap.current), []);

  // ← / → from anywhere step the snapped post's carousel (feed-stream.tsx).
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const article = root.current?.closest("article");
    if (!article || !embla) return;
    const onStep = (event: Event) => {
      if ((event as CustomEvent<number>).detail > 0) embla.scrollNext();
      else embla.scrollPrev();
    };
    article.addEventListener(CAROUSEL_STEP_EVENT, onStep);
    return () => article.removeEventListener(CAROUSEL_STEP_EVENT, onStep);
  }, [embla]);

  const current = media[index];
  const multiple = media.length > 1;

  // Embla swallows the click that ends a drag, so a swipe is never a tap.
  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const now = event.timeStamp;
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      clearTimeout(singleTap.current);
      lastTap.current = 0;
      const box = event.currentTarget.getBoundingClientRect();
      setBlooms((b) => [
        ...b,
        { id: now, x: event.clientX - box.left, y: event.clientY - box.top },
      ]);
      onDoubleTap();
      return;
    }
    lastTap.current = now;
    if (current && isVideoType(current.type)) {
      // Wait out the double-tap window so a like doesn't also pause the video.
      singleTap.current = setTimeout(() => setVideoPaused((p) => !p), DOUBLE_TAP_MS);
    }
  };

  return (
    <div
      ref={root}
      className="group relative w-full overflow-hidden bg-background"
      style={{ aspectRatio: ratio }}
      role={multiple ? "region" : undefined}
      aria-roledescription={multiple ? "carousel" : undefined}
      aria-label={multiple ? "Post media" : undefined}
    >
      <div
        ref={emblaRef}
        className="size-full touch-pan-y touch-pinch-zoom select-none"
        onClick={handleClick}
      >
        <div className="flex size-full">
          {media.map((item, i) => (
            <div
              key={item.id}
              className="relative size-full min-w-0 shrink-0 grow-0 basis-full"
              aria-roledescription={multiple ? "slide" : undefined}
              aria-label={multiple ? `${i + 1} of ${media.length}` : undefined}
              aria-hidden={i !== index || undefined}
            >
              {isVideoType(item.type) ? (
                <PostVideo media={item} active={i === index} paused={videoPaused} />
              ) : (
                <Image
                  src={item.url}
                  alt={item.alt ?? ""}
                  fill
                  draggable={false}
                  priority={priority && i === 0}
                  sizes="(min-width: 768px) 70vw, 100vw"
                  className="object-contain"
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {blooms.map((bloom) => (
        <Heart
          key={bloom.id}
          aria-hidden
          weight="Filled"
          className="pointer-events-none absolute size-24 animate-heart-bloom text-foreground drop-shadow-lg motion-reduce:hidden"
          style={{ left: bloom.x, top: bloom.y }}
          onAnimationEnd={() => setBlooms((b) => b.filter((x) => x.id !== bloom.id))}
        />
      ))}

      {current && isVideoType(current.type) && videoPaused && (
        <span
          aria-hidden
          className={cn(pill, "pointer-events-none absolute top-1/2 left-1/2 flex size-16 -translate-1/2 items-center justify-center")}
        >
          <Play aria-hidden weight="Filled" className="size-7 translate-x-0.5" />
        </span>
      )}

      {multiple && (
        <>
          <span
            aria-hidden
            className={cn(pill, "pointer-events-none absolute top-3 right-3 px-2.5 py-1 text-xs font-medium tabular-nums")}
          >
            {index + 1}/{media.length}
          </span>
          <span className="sr-only" aria-live="polite">
            {`Showing ${index + 1} of ${media.length}`}
          </span>
          {index > 0 && (
            <button
              type="button"
              aria-label="Previous"
              onClick={() => embla?.scrollPrev()}
              className={cn(pill, "absolute top-1/2 left-3 hidden size-8 -translate-y-1/2 items-center justify-center opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none md:flex")}
            >
              <ChevronLeft aria-hidden className="size-4" />
            </button>
          )}
          {index < media.length - 1 && (
            <button
              type="button"
              aria-label="Next"
              onClick={() => embla?.scrollNext()}
              className={cn(pill, "absolute top-1/2 right-3 hidden size-8 -translate-y-1/2 items-center justify-center opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none md:flex")}
            >
              <ChevronRight aria-hidden className="size-4" />
            </button>
          )}
        </>
      )}
    </div>
  );
}

/** Plays muted while it is the visible slide of a post that is on screen. */
function PostVideo({
  media,
  active,
  paused,
}: {
  media: FeedMedia;
  active: boolean;
  paused: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [inView, setInView] = useState(false);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(Boolean(entry?.isIntersecting)),
      { threshold: 0.6 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (active && inView && !paused) {
      // Autoplay can still be refused (e.g. power saving); the play badge stays usable.
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [active, inView, paused]);

  return (
    <>
      <video
        ref={ref}
        src={media.url}
        poster={media.cover?.url}
        muted={muted}
        loop
        playsInline
        preload="metadata"
        aria-label={media.alt ?? "Video"}
        className="size-full object-contain"
      />
      <button
        type="button"
        aria-label={muted ? "Unmute" : "Mute"}
        aria-pressed={!muted}
        onClick={(event) => {
          event.stopPropagation();
          setMuted((m) => !m);
        }}
        className={cn(pill, "absolute right-3 bottom-3 flex size-8 items-center justify-center focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none")}
      >
        {muted ? <VolumeCross aria-hidden className="size-4" /> : <VolumeHigh aria-hidden className="size-4" />}
      </button>
    </>
  );
}
