"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

import type { Gif } from "@/interfaces/post.interface";
import { useGifsInfiniteQuery, type ApiError } from "@/store/api";
import { useT } from "../i18n-provider";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Spinner } from "../ui/spinner";

/**
 * "GIF" button opening a GIPHY search (trending until you type); a pick
 * closes it. GIPHY's terms ask for the "Powered by GIPHY" line.
 */
export default function GifPicker({
  onPick,
  disabled,
  className,
}: {
  onPick: (gif: Gif) => void;
  disabled?: boolean;
  className?: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const more = useRef<HTMLDivElement>(null);
  const { data, isLoading, isError, error, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useGifsInfiniteQuery(query, { skip: !open });
  const gifs = data?.pages.flatMap((p) => p.gifs) ?? [];

  // Wait for a pause in typing before asking GIPHY.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(text.trim()), 300);
    return () => clearTimeout(timer);
  }, [text]);

  useEffect(() => {
    const node = more.current;
    if (!node || !hasNextPage) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting && !isFetchingNextPage) void fetchNextPage();
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("addGif")}
            disabled={disabled}
            className={className}
          />
        }
      >
        <span className="rounded-sm border border-current px-0.5 text-[0.625rem] leading-tight font-bold">
          GIF
        </span>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        className="flex h-[min(26rem,70svh)] w-80 flex-col gap-2 overflow-hidden overscroll-contain p-2"
      >
        <Input
          type="search"
          autoFocus
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={t("searchGifs")}
          aria-label={t("searchGifs")}
          className="h-9 shrink-0"
        />
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <Spinner />
            </div>
          ) : isError ? (
            <p className="px-3 py-10 text-center text-sm text-muted-foreground">
              {(error as ApiError).status === 503 ? t("gifsNotSetUp") : t("gifsLoadFailed")}
            </p>
          ) : !gifs.length ? (
            <p className="px-3 py-10 text-center text-sm text-muted-foreground">{t("noResults")}</p>
          ) : (
            <ul className="columns-2 gap-1">
              {gifs.map((gif) => (
                <li key={gif.id} className="mb-1 break-inside-avoid">
                  <button
                    type="button"
                    aria-label={gif.title || t("gif")}
                    onClick={() => {
                      onPick({ url: gif.url, width: gif.width, height: gif.height });
                      setOpen(false);
                      setText("");
                    }}
                    className="block w-full overflow-hidden rounded-md bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    {/* Animated webp: the optimiser would flatten it to one frame. */}
                    <Image
                      src={gif.preview}
                      alt=""
                      width={gif.width}
                      height={gif.height}
                      unoptimized
                      className="h-auto w-full"
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div ref={more} className="flex min-h-1 justify-center py-1">
            {isFetchingNextPage && <Spinner />}
          </div>
        </div>
        <p className="shrink-0 text-center text-[0.625rem] font-semibold tracking-wider text-muted-foreground uppercase">
          {t("poweredByGiphy")}
        </p>
      </PopoverContent>
    </Popover>
  );
}
