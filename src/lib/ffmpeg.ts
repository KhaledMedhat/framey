"use client";

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

const CORE_BASE = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.9/dist/esm";
const LOAD_TIMEOUT_MS = 60_000;

let ffmpeg: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

export async function getFFmpeg() {
  if (ffmpeg?.loaded) return ffmpeg;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const instance = new FFmpeg();
    const origin = window.location.origin;
    // public/ffmpeg/ holds worker.js, const.js and errors.js copied from
    // node_modules/@ffmpeg/ffmpeg/dist/esm; re-copy them when upgrading it.
    // A worker that fails to start never settles load(), so give up instead.
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      instance.load({
        classWorkerURL: `${origin}/ffmpeg/worker.js`,
        coreURL: `${CORE_BASE}/ffmpeg-core.js`,
        wasmURL: `${CORE_BASE}/ffmpeg-core.wasm`,
      }),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          instance.terminate();
          reject(new Error("The video tools didn't load. Try again."));
        }, LOAD_TIMEOUT_MS);
      }),
    ]).finally(() => clearTimeout(timer));
    ffmpeg = instance;
    return instance;
  })().catch((error) => {
    loadPromise = null;
    throw error;
  });

  return loadPromise;
}

export type CompressVideoOptions = {
  trimStart: number;
  trimEnd: number;
  muted: boolean;
  ratio?: "original" | "1:1" | "4:5" | "16:9";
  onProgress?: (progress: number) => void;
};

function cropFilter(ratio?: CompressVideoOptions["ratio"]) {
  if (!ratio || ratio === "original") return null;
  if (ratio === "1:1") return "crop=min(iw\\,ih):min(iw\\,ih)";
  if (ratio === "4:5") {
    return "crop=if(gt(iw/ih\\,4/5)\\,ih*4/5\\,iw):if(gt(iw/ih\\,4/5)\\,ih\\,iw*5/4)";
  }
  return "crop=if(gt(iw/ih\\,16/9)\\,ih*16/9\\,iw):if(gt(iw/ih\\,16/9)\\,ih\\,iw*9/16)";
}

// Runs after the crop, so it sees the cropped size: long edge capped at 1080,
// never upscaled, both sides even (yuv420p requires it). The quotes protect
// the commas inside min().
const SCALE_FILTER =
  "scale='min(1080,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2";

function inputNameFor(file: File) {
  const match = file.name.match(/\.[^./\\]+$/);
  return `input${match?.[0]?.toLowerCase() ?? ".mp4"}`;
}

export async function compressVideo(file: File, options: CompressVideoOptions) {
  const instance = await getFFmpeg();
  const inputName = inputNameFor(file);
  const outputName = "output.mp4";
  const clipDuration = Math.max(0.1, options.trimEnd - options.trimStart);
  const vf = [cropFilter(options.ratio), SCALE_FILTER]
    .filter(Boolean)
    .join(",");

  await instance.writeFile(inputName, await fetchFile(file));

  const logs: string[] = [];
  const onLog = ({ message }: { message: string }) => {
    logs.push(message);
  };
  const onProgress = ({ progress }: { progress: number }) => {
    options.onProgress?.(Math.min(1, Math.max(0, progress)));
  };
  instance.on("log", onLog);
  instance.on("progress", onProgress);

  try {
    const code = await instance.exec([
      "-y",
      "-ss",
      options.trimStart.toFixed(3),
      "-i",
      inputName,
      "-t",
      clipDuration.toFixed(3),
      "-vf",
      vf,
      // Drops container metadata such as a phone's GPS position.
      "-map_metadata",
      "-1",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      // 23 is x264's default: visually clean at 1080p and about half the
      // size of 20, which matters for a single-threaded wasm encode + upload.
      "-crf",
      "23",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      ...(options.muted
        ? ["-an"]
        : ["-c:a", "aac", "-b:a", "128k", "-ac", "2"]),
      outputName,
    ]);
    if (code !== 0 || logs.some((line) => /unknown encoder/i.test(line))) {
      throw new Error("Could not compress this video.");
    }

    const data = await instance.readFile(outputName);
    const bytes =
      data instanceof Uint8Array ? data : new TextEncoder().encode(data);
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    return new File([copy], file.name.replace(/\.[^.]+$/, "") + "-framey.mp4", {
      type: "video/mp4",
    });
  } finally {
    instance.off("log", onLog);
    instance.off("progress", onProgress);
    await instance.deleteFile(inputName).catch(() => undefined);
    await instance.deleteFile(outputName).catch(() => undefined);
  }
}
