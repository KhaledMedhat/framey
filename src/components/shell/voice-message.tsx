"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, VolumeCross, VolumeHigh, VolumeLow } from "reicon-react";

import { cn } from "@/lib/utils";
import { useT } from "../i18n-provider";
import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Slider } from "../ui/slider";

const BARS = 40;
const SPEEDS = [1, 1.5, 2] as const;

/** `m:ss`. */
export const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

// Decoded once per URL for the tab: the shape, and a real duration (a
// recorded webm reports none until played through).
const decoded = new Map<string, Promise<{ peaks: number[]; duration: number }>>();

/** BARS loudness levels (0-1) across the recording, and its length. */
function analyse(url: string) {
  let job = decoded.get(url);
  if (!job) {
    job = fetch(url)
      .then((res) => res.arrayBuffer())
      .then(async (data) => {
        const context = new AudioContext();
        try {
          const buffer = await context.decodeAudioData(data);
          const samples = buffer.getChannelData(0);
          const size = Math.max(1, Math.floor(samples.length / BARS));
          const levels = Array.from({ length: BARS }, (_, bar) => {
            let sum = 0;
            for (let i = bar * size; i < (bar + 1) * size && i < samples.length; i++) {
              sum += samples[i]! * samples[i]!;
            }
            return Math.sqrt(sum / size);
          });
          const loudest = Math.max(...levels, 0.0001);
          return {
            peaks: levels.map((level) => Math.max(0.08, level / loudest)),
            duration: buffer.duration,
          };
        } finally {
          void context.close();
        }
      });
    decoded.set(url, job);
    job.catch(() => decoded.delete(url));
  }
  return job;
}

/** Evenly quiet bars while the real shape loads (or if it can't). */
const FLAT = Array.from({ length: BARS }, (_, i) => 0.25 + 0.15 * Math.sin(i * 0.9));

/**
 * A voice note: play/pause, its waveform (click or drag anywhere on it to
 * listen from there; arrow keys step 5s), time, speed and volume.
 */
export default function VoiceMessage({ url, mine }: { url: string; mine: boolean }) {
  const t = useT();
  const audio = useRef<HTMLAudioElement>(null);
  const [peaks, setPeaks] = useState<number[]>(FLAT);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    let live = true;
    analyse(url)
      .then((result) => {
        if (!live) return;
        setPeaks(result.peaks);
        setDuration(result.duration);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [url]);

  // Smooth progress while playing; `timeupdate` only fires a few times a second.
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const tick = () => {
      if (audio.current) setTime(audio.current.currentTime);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  useEffect(() => {
    if (!audio.current) return;
    audio.current.playbackRate = speed;
    audio.current.volume = volume;
    audio.current.muted = muted;
  }, [speed, volume, muted]);

  // From the decode, else the element (webm only knows once it has played).
  const length = duration;
  const progress = length ? Math.min(1, time / length) : 0;

  const seek = (to: number) => {
    const el = audio.current;
    if (!el || !length) return;
    el.currentTime = Math.min(length, Math.max(0, to));
    setTime(el.currentTime);
  };
  const seekAt = (event: React.PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    let fraction = (event.clientX - box.left) / box.width;
    if (document.dir === "rtl") fraction = 1 - fraction;
    seek(Math.min(1, Math.max(0, fraction)) * length);
  };

  return (
    <div
      className={cn(
        "flex w-72 max-w-full items-center gap-2 rounded-3xl py-1.5 ps-1.5 pe-3",
        mine ? "bg-primary text-primary-foreground" : "bg-muted",
      )}
    >
      <audio
        ref={audio}
        src={url}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setTime(0);
        }}
        onDurationChange={(event) => {
          const d = event.currentTarget.duration;
          if (!duration && Number.isFinite(d)) setDuration(d);
        }}
      />
      <Button
        type="button"
        size="icon-sm"
        aria-label={playing ? t("pause") : t("play")}
        onClick={() => (playing ? audio.current?.pause() : void audio.current?.play())}
        className={cn(
          "shrink-0 rounded-full",
          mine
            ? "bg-primary-foreground text-primary hover:bg-primary-foreground/90"
            : "bg-foreground text-background hover:bg-foreground/90",
        )}
      >
        {playing ? <Pause aria-hidden weight="Filled" /> : <Play aria-hidden weight="Filled" />}
      </Button>

      <div
        role="slider"
        tabIndex={0}
        aria-label={t("voiceMessage")}
        aria-valuemin={0}
        aria-valuemax={Math.round(length)}
        aria-valuenow={Math.round(time)}
        aria-valuetext={`${clock(time)} / ${clock(length)}`}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          seekAt(event);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) seekAt(event);
        }}
        onKeyDown={(event) => {
          // Right is later (left in RTL); up/down always forward/back.
          const flip = document.dir === "rtl" ? -1 : 1;
          const step = { ArrowRight: 5 * flip, ArrowLeft: -5 * flip, ArrowUp: 5, ArrowDown: -5 }[
            event.key
          ];
          if (step === undefined) return;
          event.preventDefault();
          seek(time + step);
        }}
        className="flex h-8 min-w-0 flex-1 cursor-pointer touch-none items-center gap-[2px] rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {peaks.map((peak, i) => (
          <span
            key={i}
            style={{ height: `${Math.round(peak * 100)}%` }}
            className={cn(
              "min-h-[3px] flex-1 rounded-full transition-colors duration-100",
              (i + 0.5) / peaks.length <= progress
                ? mine
                  ? "bg-primary-foreground"
                  : "bg-foreground"
                : mine
                  ? "bg-primary-foreground/35"
                  : "bg-foreground/30",
            )}
          />
        ))}
      </div>

      <span className="w-9 shrink-0 text-end text-xs tabular-nums opacity-80">
        {clock(playing || time ? time : length)}
      </span>

      <button
        type="button"
        aria-label={t("playbackSpeed", { speed: `${speed}x` })}
        onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]!)}
        className={cn(
          "h-6 shrink-0 rounded-full px-1.5 text-[0.6875rem] font-semibold tabular-nums focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
          mine ? "bg-primary-foreground/15" : "bg-foreground/10",
        )}
      >
        {speed}x
      </button>

      <Popover>
        <PopoverTrigger
          render={
            <button
              type="button"
              aria-label={t("volume")}
              className="shrink-0 rounded-full p-0.5 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            />
          }
        >
          {muted || volume === 0 ? (
            <VolumeCross aria-hidden className="size-4" />
          ) : volume < 0.5 ? (
            <VolumeLow aria-hidden className="size-4" />
          ) : (
            <VolumeHigh aria-hidden className="size-4" />
          )}
        </PopoverTrigger>
        <PopoverContent side="top" className="flex w-52 flex-row items-center gap-3 p-3">
          <button
            type="button"
            aria-label={muted ? t("unmute") : t("mute")}
            aria-pressed={muted}
            onClick={() => setMuted((m) => !m)}
            className="shrink-0 rounded-full p-1 hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {muted || volume === 0 ? (
              <VolumeCross aria-hidden className="size-5" />
            ) : (
              <VolumeHigh aria-hidden className="size-5" />
            )}
          </button>
          <Slider
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
        </PopoverContent>
      </Popover>
    </div>
  );
}
