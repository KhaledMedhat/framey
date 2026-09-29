"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import useEmblaCarousel from "embla-carousel-react";
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  User,
  VolumeCross,
  VolumeHigh,
} from "reicon-react";

import type { FeedMedia, PhotoTag } from "@/interfaces/post.interface";
import { isVideoType } from "@/lib/files";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { ProfileHoverCard } from "./profile-hover-card";
import { Slider } from "../ui/slider";
import { useT } from "../i18n-provider";

const DOUBLE_TAP_MS = 280;

/** A photo's width / height, falling back to the frame's when unknown. */
const photoRatio = (item: FeedMedia, frame: number) =>
  item.width && item.height ? item.width / item.height : frame;

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
  tags = [],
  ratio,
  priority,
  onDoubleTap,
  onTap,
}: {
  media: FeedMedia[];
  tags?: PhotoTag[];
  ratio: number;
  priority: boolean;
  onDoubleTap: () => void;
  /** A single tap (once the double-tap window passes): the feed opens the post. */
  onTap?: () => void;
}) {
  const [emblaRef, embla] = useEmblaCarousel({ watchDrag: media.length > 1 });
  const t = useT();
  const [index, setIndex] = useState(0);
  const [showTags, setShowTags] = useState(true);
  const slideTags = tags.filter((tag) => tag.mediaIndex === index);
  const [blooms, setBlooms] = useState<{ id: number; x: number; y: number }[]>(
    [],
  );
  const lastTap = useRef(0);
  const singleTap = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!embla) return;
    const onSelect = () => {
      setIndex(embla.selectedScrollSnap());
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
    // Wait out the double-tap window so a like doesn't also open the post.
    if (onTap) singleTap.current = setTimeout(onTap, DOUBLE_TAP_MS);
  };

  return (
    <div
      ref={root}
      className="group relative w-full overflow-hidden bg-background"
      style={{ aspectRatio: ratio }}
      role={multiple ? "region" : undefined}
      aria-roledescription={multiple ? "carousel" : undefined}
      aria-label={multiple ? t("postMedia") : undefined}
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
              aria-label={
                multiple
                  ? t("nOfTotal", {
                      n: String(i + 1),
                      total: String(media.length),
                    })
                  : undefined
              }
              aria-hidden={i !== index || undefined}
            >
              {isVideoType(item.type) ? (
                <PostVideo media={item} active={i === index} />
              ) : (
                <Image
                  src={item.url}
                  alt={item.alt ?? ""}
                  fill
                  draggable={false}
                  priority={priority && i === 0}
                  quality={90}
                  sizes="(min-width: 768px) 70vw, 100vw"
                  className="object-contain"
                />
              )}
              {/* Tags sit on the photo's own box, not the letterbox around it. */}
              {showTags && i === index && slideTags.length > 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div
                    className="relative"
                    style={{
                      width: `${Math.min(1, photoRatio(item, ratio) / ratio) * 100}%`,
                      height: `${Math.min(1, ratio / photoRatio(item, ratio)) * 100}%`,
                    }}
                  >
                    {slideTags.map((tag) => (
                      <div
                        key={tag.userId}
                        // Keep taps and drags off the post (open/like) and carousel.
                        onClick={(event) => event.stopPropagation()}
                        onPointerDown={(event) => event.stopPropagation()}
                        className="absolute -translate-x-1/2 animate-in fade-in-0 zoom-in-95 motion-reduce:animate-none"
                        style={{
                          left: `${tag.x * 100}%`,
                          top: `${tag.y * 100}%`,
                        }}
                      >
                        <ProfileHoverCard
                          username={tag.username}
                          className="block max-w-40 truncate rounded-md bg-black/75 px-2.5 py-1.5 text-xs font-semibold text-white focus-visible:ring-3 focus-visible:ring-white/50 focus-visible:outline-none"
                        >
                          {tag.username}
                        </ProfileHoverCard>
                      </div>
                    ))}
                  </div>
                </div>
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
          className="pointer-events-none absolute size-24 animate-heart-bloom text-destructive drop-shadow-lg motion-reduce:hidden"
          style={{ left: bloom.x, top: bloom.y }}
          onAnimationEnd={() =>
            setBlooms((b) => b.filter((x) => x.id !== bloom.id))
          }
        />
      ))}

      {slideTags.length > 0 && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t("taggedPeople")}
          aria-pressed={showTags}
          onClick={() => setShowTags((s) => !s)}
          className={cn(
            pill,
            "absolute bottom-3 left-3 flex size-8 items-center justify-center",
          )}
        >
          <User aria-hidden weight="Filled" className="size-4" />
        </Button>
      )}

      {multiple && (
        <>
          <span
            aria-hidden
            className={cn(
              pill,
              "pointer-events-none absolute top-3 right-3 px-2.5 py-1 text-xs font-medium tabular-nums",
            )}
          >
            {index + 1}/{media.length}
          </span>
          <span className="sr-only" aria-live="polite">
            {`Showing ${index + 1} of ${media.length}`}
          </span>
          {index > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t("previous")}
              onClick={() => embla?.scrollPrev()}
              className={cn(
                pill,
                "absolute top-1/2 left-3 hidden size-8 -translate-y-1/2 items-center justify-center opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none md:flex",
              )}
            >
              <ChevronLeft aria-hidden className="size-4" />
            </Button>
          )}
          {index < media.length - 1 && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t("next")}
              onClick={() => embla?.scrollNext()}
              className={cn(
                pill,
                "absolute top-1/2 right-3 hidden size-8 -translate-y-1/2 items-center justify-center opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none md:flex",
              )}
            >
              <ChevronRight aria-hidden className="size-4" />
            </Button>
          )}
        </>
      )}
    </div>
  );
}

/** Plays muted while it is the visible slide of a post that is on screen. */
function PostVideo({ media, active }: { media: FeedMedia; active: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const t = useT();
  const [inView, setInView] = useState(false);
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(1);

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
    if (active && inView) {
      // Autoplay can still be refused (e.g. power saving).
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [active, inView]);

  useEffect(() => {
    if (ref.current) ref.current.volume = volume;
  }, [volume]);

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
        aria-label={media.alt ?? t("video")}
        className="size-full object-contain"
      />
      {/* Hover the speaker for a volume slider. Stops taps and drags here from
          reaching the post (open) or the carousel (swipe). */}
      <div
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        className="group/volume absolute right-3 bottom-3 flex flex-col items-center gap-2"
      >
        <div
          className={cn(
            pill,
            "hidden px-2 py-3 group-focus-within/volume:flex group-hover/volume:flex",
          )}
        >
          <Slider
            orientation="vertical"
            aria-label={t("volume")}
            min={0}
            max={100}
            value={[muted ? 0 : Math.round(volume * 100)]}
            onValueChange={(value) => {
              const next = (Array.isArray(value) ? value[0]! : value) / 100;
              setVolume(next);
              setMuted(next === 0);
            }}
          />
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          type="button"
          aria-label={muted ? t("unmute") : t("mute")}
          aria-pressed={!muted}
          onClick={() => {
            if (muted && volume === 0) setVolume(1);
            setMuted((m) => !m);
          }}
          className={cn(pill, "flex size-8 items-center justify-center")}
        >
          {muted ? (
            <VolumeCross aria-hidden size={8} />
          ) : (
            <VolumeHigh aria-hidden size={8} />
          )}
        </Button>
      </div>
    </>
  );
}
