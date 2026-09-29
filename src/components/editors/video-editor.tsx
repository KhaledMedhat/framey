"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "reicon-react";
import { compressVideo } from "@/lib/ffmpeg";
import type { EditedPostMedia } from "@/interfaces/post.interface";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";
import { Field, FieldLabel, FieldContent } from "../ui/field";
import { Switch } from "../ui/switch";
import { useT } from "../i18n-provider";

const FILMSTRIP_FRAMES = 12;
const MIN_CLIP = 0.5;

export type VideoRatio = "original" | "1:1" | "4:5" | "16:9";

export type VideoSession = {
  kind: "video";
  id: string;
  file: File;
  previewUrl: string;
  loaded: boolean;
  duration: number;
  width: number;
  height: number;
  ratio: VideoRatio;
  trimStart: number;
  trimEnd: number;
  coverTime: number;
  muted: boolean;
  filmstrip: string[];
};

function waitForEvent(target: EventTarget, event: string) {
  return new Promise<void>((resolve, reject) => {
    const onSuccess = () => {
      target.removeEventListener(event, onSuccess);
      target.removeEventListener("error", onError);
      resolve();
    };
    const onError = () => {
      target.removeEventListener(event, onSuccess);
      target.removeEventListener("error", onError);
      reject(new Error("Video failed to load."));
    };
    target.addEventListener(event, onSuccess, { once: true });
    target.addEventListener("error", onError, { once: true });
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatTime(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function sourceCropRect(width: number, height: number, aspect: number) {
  const sourceAspect = width / Math.max(1, height);
  if (sourceAspect > aspect) {
    const w = height * aspect;
    return { x: (width - w) / 2, y: 0, w, h: height };
  }
  const h = width / Math.max(aspect, 0.01);
  return { x: 0, y: (height - h) / 2, w: width, h };
}

export async function captureVideoFrame(
  video: HTMLVideoElement,
  time: number,
  quality = 0.85,
  cropAspect?: number,
) {
  video.currentTime = time;
  await waitForEvent(video, "seeked");
  const sourceW = Math.max(1, video.videoWidth);
  const sourceH = Math.max(1, video.videoHeight);
  const crop = cropAspect
    ? sourceCropRect(sourceW, sourceH, cropAspect)
    : { x: 0, y: 0, w: sourceW, h: sourceH };
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(crop.w));
  canvas.height = Math.max(1, Math.round(crop.h));
  canvas
    .getContext("2d")
    ?.drawImage(
      video,
      crop.x,
      crop.y,
      crop.w,
      crop.h,
      0,
      0,
      canvas.width,
      canvas.height,
    );
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) =>
        result
          ? resolve(result)
          : reject(new Error("Could not capture cover.")),
      "image/jpeg",
      quality,
    );
  });
  return blob;
}

export function revokeVideoSession(session: VideoSession) {
  URL.revokeObjectURL(session.previewUrl);
  session.filmstrip.forEach((url) => URL.revokeObjectURL(url));
}

export async function loadVideoSession(
  file: File,
  index: number,
): Promise<VideoSession> {
  const previewUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = previewUrl;
  await waitForEvent(video, "loadedmetadata");

  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  const filmstrip: string[] = [];
  const count = duration > 0 ? FILMSTRIP_FRAMES : 0;
  for (let frame = 0; frame < count; frame += 1) {
    const time = count <= 1 ? 0 : duration * (frame / (count - 1));
    const blob = await captureVideoFrame(video, time, 0.55);
    filmstrip.push(URL.createObjectURL(blob));
  }

  video.removeAttribute("src");
  video.load();

  return {
    kind: "video",
    id: `${file.name}-${file.lastModified}-${index}-${file.size}`,
    file,
    previewUrl,
    loaded: true,
    duration,
    width: video.videoWidth,
    height: video.videoHeight,
    ratio: "1:1",
    trimStart: 0,
    trimEnd: duration,
    coverTime: 0,
    muted: false,
    filmstrip,
  };
}

export function getVideoCropAspect(
  ratio: VideoRatio,
  width: number,
  height: number,
) {
  if (ratio === "original") return width / Math.max(1, height);
  if (ratio === "1:1") return 1;
  if (ratio === "4:5") return 4 / 5;
  return 16 / 9;
}

export async function videoSessionToDraft(
  session: VideoSession,
): Promise<EditedPostMedia> {
  const draft: EditedPostMedia = {
    file: session.file,
    muted: session.muted,
    duration: Math.max(0, session.trimEnd - session.trimStart),
    trimStart: session.trimStart,
    trimEnd: session.trimEnd,
    coverTime: session.coverTime,
    ratio: session.ratio,
    width: session.width,
    height: session.height,
    needsCompress: true,
  };

  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.src = session.previewUrl;
    await waitForEvent(video, "loadedmetadata");
    const coverTime = clamp(
      session.coverTime,
      session.trimStart,
      session.trimEnd,
    );
    const coverBlob = await captureVideoFrame(
      video,
      coverTime,
      0.85,
      getVideoCropAspect(session.ratio, session.width, session.height),
    );
    video.removeAttribute("src");
    video.load();
    return {
      ...draft,
      cover: new File(
        [coverBlob],
        session.file.name.replace(/\.[^.]+$/, "") + "-cover.jpg",
        { type: "image/jpeg" },
      ),
    };
  } catch {
    return draft;
  }
}

export async function finalizeVideoMedia(
  item: EditedPostMedia,
  onProgress?: (progress: number) => void,
): Promise<EditedPostMedia> {
  if (!item.needsCompress) return item;

  const previewUrl = URL.createObjectURL(item.file);
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.src = previewUrl;
    await waitForEvent(video, "loadedmetadata");
    const coverTime = clamp(
      item.coverTime ?? item.trimStart ?? 0,
      item.trimStart ?? 0,
      item.trimEnd ?? video.duration,
    );
    const coverBlob = await captureVideoFrame(
      video,
      coverTime,
      0.85,
      getVideoCropAspect(
        item.ratio ?? "1:1",
        video.videoWidth,
        video.videoHeight,
      ),
    );
    video.removeAttribute("src");
    video.load();

    const processed = await compressVideo(item.file, {
      trimStart: item.trimStart ?? 0,
      trimEnd: item.trimEnd ?? video.duration,
      muted: item.muted ?? false,
      ratio: item.ratio,
      onProgress,
    });

    return {
      ...item,
      file: processed,
      cover: new File(
        [coverBlob],
        item.file.name.replace(/\.[^.]+$/, "") + "-cover.jpg",
        { type: "image/jpeg" },
      ),
      needsCompress: false,
    };
  } finally {
    URL.revokeObjectURL(previewUrl);
  }
}

const overlayClassName =
  "rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur-sm";

export function VideoClipPane({
  session,
  stage,
  active,
}: {
  session: VideoSession;
  stage: "crop" | "edit";
  active: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const trimRef = useRef({ start: session.trimStart, end: session.trimEnd });
  const enteredEditRef = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!active) {
      video.pause();
      setPlaying(false);
      enteredEditRef.current = false;
      return;
    }

    if (stage === "crop") {
      enteredEditRef.current = false;
      video.loop = true;
      video.muted = true;
      void video.play();
      return;
    }

    video.loop = false;
    video.muted = session.muted;
    if (!enteredEditRef.current) {
      enteredEditRef.current = true;
      video.pause();
      setPlaying(false);
    }
  }, [active, session.id, session.muted, stage]);

  useEffect(() => {
    const video = videoRef.current;
    const previous = trimRef.current;
    const changed =
      previous.start !== session.trimStart || previous.end !== session.trimEnd;
    trimRef.current = { start: session.trimStart, end: session.trimEnd };
    if (!video || !active || stage !== "edit" || !changed) return;
    if (previous.start !== session.trimStart) {
      video.currentTime = session.trimStart;
    } else {
      video.currentTime = Math.max(session.trimStart, session.trimEnd - 0.08);
    }
    if (!video.paused) void video.play();
  }, [active, session.trimEnd, session.trimStart, stage]);

  const keepInTrim = () => {
    const video = videoRef.current;
    if (!video || video.paused) return;
    if (
      video.currentTime < session.trimStart ||
      video.currentTime >= session.trimEnd - 0.04
    ) {
      video.currentTime = session.trimStart;
      void video.play();
    }
  };

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      if (
        video.currentTime < session.trimStart ||
        video.currentTime >= session.trimEnd
      ) {
        video.currentTime = session.trimStart;
      }
      void video.play();
      return;
    }
    video.pause();
  };

  return (
    <div className="relative size-full bg-black">
      <video
        ref={videoRef}
        src={session.previewUrl}
        className="size-full object-cover"
        playsInline
        disablePictureInPicture
        controls={false}
        muted={stage === "crop" ? true : session.muted}
        onLoadedMetadata={() => {
          const video = videoRef.current;
          if (!video || stage === "edit") return;
          void video.play();
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          const video = videoRef.current;
          if (!video) return;
          video.currentTime = session.trimStart;
          if (stage === "crop" || !video.paused) void video.play();
          else setPlaying(false);
        }}
        onTimeUpdate={keepInTrim}
      />
      {stage === "edit" && (
        <Button
          type="button"
          size="icon-lg"
          variant="secondary"
          className={cn(
            overlayClassName,
            "absolute top-1/2 left-1/2 z-10 size-14 -translate-x-1/2 -translate-y-1/2",
          )}
          onClick={togglePlayback}
        >
          {playing ? <Pause size={28} /> : <Play size={28} />}
          <span className="sr-only">{playing ? "Pause" : "Play"}</span>
        </Button>
      )}
    </div>
  );
}

export function FormVideoPreview({
  src,
  poster,
  muted,
  trimStart = 0,
  trimEnd,
  className,
}: {
  src: string;
  poster?: string;
  muted?: boolean;
  trimStart?: number;
  trimEnd?: number;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const end = trimEnd ?? Number.POSITIVE_INFINITY;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = trimStart;
    video.pause();
    setPlaying(false);
  }, [src, trimStart]);

  const keepInTrim = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.currentTime < trimStart || video.currentTime >= end - 0.04) {
      video.currentTime = trimStart;
      if (!video.paused) void video.play();
    }
  };

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      if (video.currentTime < trimStart || video.currentTime >= end) {
        video.currentTime = trimStart;
      }
      void video.play();
      return;
    }
    video.pause();
  };

  return (
    <div className="relative size-full">
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className={cn("size-full object-cover", className)}
        playsInline
        disablePictureInPicture
        controls={false}
        muted={muted}
        onLoadedMetadata={() => {
          const video = videoRef.current;
          if (video) video.currentTime = trimStart;
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          const video = videoRef.current;
          if (!video) return;
          video.currentTime = trimStart;
          setPlaying(false);
        }}
        onTimeUpdate={keepInTrim}
      />
      <Button
        type="button"
        size="icon-lg"
        variant="secondary"
        className={cn(
          overlayClassName,
          "absolute top-1/2 left-1/2 z-10 size-14 -translate-x-1/2 -translate-y-1/2",
        )}
        onClick={togglePlayback}
      >
        {playing ? <Pause size={28} /> : <Play size={28} />}
        <span className="sr-only">{playing ? "Pause" : "Play"}</span>
      </Button>
    </div>
  );
}

export function VideoEditSidebar({
  session,
  onChange,
}: {
  session: VideoSession;
  onChange: (patch: Partial<VideoSession>) => void;
}) {
  const t = useT();
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4">
      <Field>
        <FieldLabel>{t("cover")}</FieldLabel>
        <p className="text-xs text-muted-foreground">
          {t("coverHint")}
        </p>
        <CoverStrip
          session={session}
          onCoverChange={(coverTime) => onChange({ coverTime })}
        />
      </Field>

      <Field>
        <FieldLabel>{t("trim")}</FieldLabel>
        <p className="text-xs text-muted-foreground">
          {formatTime(session.trimEnd - session.trimStart)}
        </p>
        <TrimStrip
          session={session}
          onTrimChange={(trimStart, trimEnd) => {
            onChange({
              trimStart,
              trimEnd,
              coverTime: clamp(session.coverTime, trimStart, trimEnd),
            });
          }}
        />
      </Field>

      <Field orientation="horizontal">
        <FieldContent>
          <FieldLabel htmlFor="video-sound">{t("sound")}</FieldLabel>
        </FieldContent>
        <Switch
          id="video-sound"
          checked={!session.muted}
          onCheckedChange={(checked) => onChange({ muted: !checked })}
        />
      </Field>
    </div>
  );
}

function CoverStrip({
  session,
  onCoverChange,
}: {
  session: VideoSession;
  onCoverChange: (time: number) => void;
}) {
  const t = useT();
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const grabOffset = useRef(0);
  const boxRatio = 0.22;
  const duration = Math.max(session.duration, 0.001);
  const coverRatio = clamp(session.coverTime / duration, 0, 1);
  const boxLeft = clamp(coverRatio - boxRatio / 2, 0, 1 - boxRatio);
  const coverIndex =
    session.filmstrip.length <= 1
      ? 0
      : Math.round(coverRatio * (session.filmstrip.length - 1));
  const coverFrame = session.filmstrip[coverIndex];

  const timeFromBoxLeft = (left: number) => {
    const center = left + boxRatio / 2;
    return clamp(center * duration, session.trimStart, session.trimEnd);
  };

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (!draggingRef.current) return;
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || rect.width <= 0) return;
      const pointer = (event.clientX - rect.left) / rect.width;
      const nextLeft = clamp(pointer - grabOffset.current, 0, 1 - boxRatio);
      onCoverChange(timeFromBoxLeft(nextLeft));
    };
    const onUp = () => {
      draggingRef.current = false;
      setDragging(false);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  });

  return (
    <div className="mt-2 flex flex-col gap-3">
      <div className="relative h-40 w-full overflow-hidden rounded-md bg-muted ring-1 ring-foreground/15">
        {coverFrame && (
          <img
            src={coverFrame}
            alt=""
            className="size-full object-cover"
            draggable={false}
          />
        )}
      </div>
      <div className="overflow-visible px-0.5 py-3">
        <div
          ref={trackRef}
          className="relative h-16 w-full touch-none overflow-visible rounded-md bg-muted"
        >
          <div className="absolute inset-0 overflow-hidden rounded-md">
            <div className="absolute inset-0 flex">
              {session.filmstrip.map((frame) => (
                <img
                  key={frame}
                  src={frame}
                  alt=""
                  className="h-full flex-1 object-cover"
                  draggable={false}
                />
              ))}
            </div>
            <div
              className="pointer-events-none absolute inset-y-0 bg-black/55"
              style={{ width: `${boxLeft * 100}%` }}
            />
            <div
              className="pointer-events-none absolute inset-y-0 bg-black/55"
              style={{ left: `${(boxLeft + boxRatio) * 100}%`, right: 0 }}
            />
          </div>
          <div
            role="slider"
            aria-label={t("coverFrame")}
            aria-valuemin={session.trimStart}
            aria-valuemax={session.trimEnd}
            aria-valuenow={session.coverTime}
            tabIndex={0}
            className="absolute top-1/2 z-10 cursor-grab overflow-hidden rounded-sm border-2 border-foreground bg-transparent shadow-md active:cursor-grabbing"
            style={{
              left: `${boxLeft * 100}%`,
              width: `${boxRatio * 100}%`,
              height: dragging ? "5.5rem" : "4rem",
              transform: `translateY(-50%) scale(${dragging ? 1.18 : 1})`,
              transformOrigin: "center center",
              transition: dragging
                ? "none"
                : "transform 150ms ease, height 150ms ease",
            }}
            onPointerDown={(event) => {
              event.preventDefault();
              const rect = trackRef.current?.getBoundingClientRect();
              if (!rect || rect.width <= 0) return;
              draggingRef.current = true;
              setDragging(true);
              grabOffset.current =
                (event.clientX - rect.left) / rect.width - boxLeft;
            }}
          >
            {coverFrame && (
              <img
                src={coverFrame}
                alt=""
                className="size-full object-cover"
                draggable={false}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TrimStrip({
  session,
  onTrimChange,
}: {
  session: VideoSession;
  onTrimChange: (start: number, end: number) => void;
}) {
  const t = useT();
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<"start" | "end" | null>(null);
  const startRatio =
    session.duration > 0 ? session.trimStart / session.duration : 0;
  const endRatio =
    session.duration > 0 ? session.trimEnd / session.duration : 1;

  const timeFromEvent = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || session.duration <= 0) return 0;
    return clamp(
      ((clientX - rect.left) / rect.width) * session.duration,
      0,
      session.duration,
    );
  };

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const time = timeFromEvent(event.clientX);
      if (drag === "start") {
        onTrimChange(
          Math.min(time, session.trimEnd - MIN_CLIP),
          session.trimEnd,
        );
      } else {
        onTrimChange(
          session.trimStart,
          Math.max(time, session.trimStart + MIN_CLIP),
        );
      }
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  });

  return (
    <div
      ref={trackRef}
      className="relative mt-2 h-14 w-full touch-none overflow-hidden rounded-md bg-muted"
    >
      <div className="absolute inset-0 flex">
        {session.filmstrip.map((frame) => (
          <img
            key={frame}
            src={frame}
            alt=""
            className="h-full flex-1 object-cover"
            draggable={false}
          />
        ))}
      </div>
      <div
        className="absolute inset-y-0 bg-black/55"
        style={{ left: 0, width: `${startRatio * 100}%` }}
      />
      <div
        className="absolute inset-y-0 bg-black/55"
        style={{ left: `${endRatio * 100}%`, right: 0 }}
      />
      <div
        className="absolute inset-y-0 rounded-sm border-2 border-foreground"
        style={{
          left: `${startRatio * 100}%`,
          width: `${Math.max(0, endRatio - startRatio) * 100}%`,
        }}
      >
        <Button
          variant="ghost"
          aria-label={t("trimStart")}
          className="absolute inset-y-0 left-0 h-auto w-3 cursor-ew-resize rounded-none p-0 hover:bg-foreground/20"
          onPointerDown={(event) => {
            event.preventDefault();
            dragRef.current = "start";
          }}
        />
        <Button
          variant="ghost"
          aria-label={t("trimEnd")}
          className="absolute inset-y-0 right-0 h-auto w-3 cursor-ew-resize rounded-none p-0 hover:bg-foreground/20"
          onPointerDown={(event) => {
            event.preventDefault();
            dragRef.current = "end";
          }}
        />
      </div>
    </div>
  );
}
