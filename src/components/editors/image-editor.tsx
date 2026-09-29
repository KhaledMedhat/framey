"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import { Field, FieldGroup, FieldLabel } from "../ui/field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import {
  ArrowLeft,
  ChevronExpandY,
  Library,
  Plus,
  SearchZoomIn,
} from "reicon-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { isImageFile, isVideoFile } from "@/lib/files";
import type { EditedPostMedia } from "@/interfaces/post.interface";
import {
  loadVideoSession,
  revokeVideoSession,
  VideoClipPane,
  VideoEditSidebar,
  videoSessionToDraft,
  type VideoSession,
} from "./video-editor";
import {
  Carousel,
  CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "../ui/carousel";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Slider } from "../ui/slider";
import type { DictKey } from "@/lib/i18n";
import { useT } from "../i18n-provider";

type Ratio = "original" | "1:1" | "4:5" | "16:9";
type EditorStage = "crop" | "edit";
type FilterName =
  | "aden"
  | "clarendon"
  | "crema"
  | "gingham"
  | "juno"
  | "lark"
  | "ludwig"
  | "moon"
  | "original"
  | "perpetua"
  | "reyes"
  | "slumber";

type Transform = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

type Adjustments = {
  brightness: number;
  contrast: number;
  fade: number;
  saturation: number;
  temperature: number;
  vignette: number;
};

type FilterPreset = {
  brightness: number;
  contrast: number;
  saturate: number;
  sepia: number;
  hue: number;
  grayscale: number;
};

type ImageSession = {
  kind: "image";
  id: string;
  file: File;
  previewUrl: string;
  loaded: boolean;
  ratio: Ratio;
  transform: Transform;
  zoom: number;
  filter: FilterName;
  adjustments: Adjustments;
  sourceSize: { width: number; height: number };
};

type EditorSession = ImageSession | VideoSession;

function isImageSession(
  session: EditorSession | undefined,
): session is ImageSession {
  return session?.kind === "image";
}

function isVideoSession(
  session: EditorSession | undefined,
): session is VideoSession {
  return session?.kind === "video";
}

const MAX_MEDIA = 10;
const ratios: Ratio[] = ["original", "1:1", "4:5", "16:9"];
const filterNames: FilterName[] = [
  "aden",
  "clarendon",
  "crema",
  "gingham",
  "juno",
  "lark",
  "ludwig",
  "moon",
  "original",
  "perpetua",
  "reyes",
  "slumber",
];

const initialTransform: Transform = { scale: 1, offsetX: 0, offsetY: 0 };
const initialAdjustments: Adjustments = {
  brightness: 0,
  contrast: 0,
  fade: 0,
  saturation: 0,
  temperature: 0,
  vignette: 0,
};

const FILTER_PRESETS: Record<FilterName, FilterPreset> = {
  original: {
    brightness: 1,
    contrast: 1,
    saturate: 1,
    sepia: 0,
    hue: 0,
    grayscale: 0,
  },
  aden: {
    brightness: 1.2,
    contrast: 0.9,
    saturate: 0.85,
    sepia: 0.15,
    hue: -20,
    grayscale: 0,
  },
  clarendon: {
    brightness: 1.05,
    contrast: 1.2,
    saturate: 1.35,
    sepia: 0,
    hue: 0,
    grayscale: 0,
  },
  crema: {
    brightness: 1.1,
    contrast: 0.9,
    saturate: 0.85,
    sepia: 0.2,
    hue: 0,
    grayscale: 0,
  },
  gingham: {
    brightness: 1.05,
    contrast: 1,
    saturate: 1,
    sepia: 0,
    hue: -10,
    grayscale: 0.05,
  },
  juno: {
    brightness: 1.05,
    contrast: 1.15,
    saturate: 1.4,
    sepia: 0.08,
    hue: -5,
    grayscale: 0,
  },
  lark: {
    brightness: 1.1,
    contrast: 0.9,
    saturate: 1.1,
    sepia: 0,
    hue: 0,
    grayscale: 0,
  },
  ludwig: {
    brightness: 1.05,
    contrast: 1.05,
    saturate: 1.2,
    sepia: 0.05,
    hue: 0,
    grayscale: 0,
  },
  moon: {
    brightness: 1.1,
    contrast: 1.1,
    saturate: 1,
    sepia: 0,
    hue: 0,
    grayscale: 1,
  },
  perpetua: {
    brightness: 1.05,
    contrast: 1.1,
    saturate: 1.1,
    sepia: 0.05,
    hue: 0,
    grayscale: 0,
  },
  reyes: {
    brightness: 1.1,
    contrast: 0.85,
    saturate: 0.75,
    sepia: 0.4,
    hue: 0,
    grayscale: 0,
  },
  slumber: {
    brightness: 1.05,
    contrast: 1,
    saturate: 0.66,
    sepia: 0.12,
    hue: 0,
    grayscale: 0,
  },
};

const ADJUSTMENT_FIELDS: {
  key: keyof Adjustments;
  label: DictKey;
  min: number;
  max: number;
}[] = [
  { key: "brightness", label: "brightness", min: -100, max: 100 },
  { key: "contrast", label: "contrast", min: -100, max: 100 },
  { key: "fade", label: "fade", min: 0, max: 100 },
  { key: "saturation", label: "saturation", min: -100, max: 100 },
  { key: "temperature", label: "temperature", min: -100, max: 100 },
  { key: "vignette", label: "vignette", min: 0, max: 100 },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getRatioValue(
  ratio: Ratio,
  sourceSize: { width: number; height: number },
) {
  if (ratio === "original") {
    return sourceSize.width / Math.max(1, sourceSize.height);
  }
  const [w, h] = ratio.split(":").map(Number);
  return (w ?? 1) / Math.max(1, h ?? 1);
}

function getContainedViewport(
  squareW: number,
  squareH: number,
  aspect: number,
) {
  const safe = Math.max(aspect, 0.01);
  return {
    width: squareW * Math.min(1, safe),
    height: squareH * Math.min(1, 1 / safe),
  };
}

function getCoverLayout(
  viewportW: number,
  viewportH: number,
  sw: number,
  sh: number,
  transform: Transform,
) {
  if (viewportW <= 0 || viewportH <= 0 || sw <= 1 || sh <= 1) {
    return {
      width: 0,
      height: 0,
      left: 0,
      top: 0,
      displayScale: 1,
      extraX: 0,
      extraY: 0,
      rect: { sx: 0, sy: 0, sWidth: Math.max(1, sw), sHeight: Math.max(1, sh) },
    };
  }

  const cover = Math.max(viewportW / sw, viewportH / sh);
  const displayScale = cover * Math.max(1, transform.scale);
  const width = sw * displayScale;
  const height = sh * displayScale;
  const extraX = Math.max(0, width - viewportW);
  const extraY = Math.max(0, height - viewportH);
  const left =
    extraX === 0
      ? (viewportW - width) / 2
      : -((extraX / 2) * (1 + transform.offsetX));
  const top =
    extraY === 0
      ? (viewportH - height) / 2
      : -((extraY / 2) * (1 + transform.offsetY));
  const sWidth = viewportW / displayScale;
  const sHeight = viewportH / displayScale;

  return {
    width,
    height,
    left,
    top,
    displayScale,
    extraX,
    extraY,
    rect: {
      sx: clamp(-left / displayScale, 0, Math.max(0, sw - sWidth)),
      sy: clamp(-top / displayScale, 0, Math.max(0, sh - sHeight)),
      sWidth,
      sHeight,
    },
  };
}

function fitFrame(availableW: number, availableH: number, aspect: number) {
  if (availableW <= 0 || availableH <= 0) {
    return { width: 0, height: 0 };
  }

  const heightFromWidth = availableW / aspect;
  if (heightFromWidth <= availableH) {
    return { width: availableW, height: heightFromWidth };
  }

  return { width: availableH * aspect, height: availableH };
}

function composeCssFilter(filterName: FilterName, adjustments: Adjustments) {
  const preset = FILTER_PRESETS[filterName];
  const brightness =
    preset.brightness *
    (1 + adjustments.brightness / 200) *
    (1 + adjustments.fade / 500);
  const contrast =
    preset.contrast *
    (1 + adjustments.contrast / 200) *
    (1 - adjustments.fade / 280);
  const saturate = preset.saturate * (1 + adjustments.saturation / 200);
  let sepia = preset.sepia;
  let hue = preset.hue;

  if (adjustments.temperature > 0) {
    sepia += adjustments.temperature / 350;
    hue -= adjustments.temperature * 0.12;
  } else if (adjustments.temperature < 0) {
    hue += Math.abs(adjustments.temperature) * 0.35;
  }

  return [
    preset.grayscale ? `grayscale(${preset.grayscale})` : "",
    `brightness(${brightness})`,
    `contrast(${contrast})`,
    `saturate(${saturate})`,
    sepia ? `sepia(${clamp(sepia, 0, 1)})` : "",
    hue ? `hue-rotate(${hue}deg)` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function createImageSession(file: File, index: number): ImageSession {
  return {
    kind: "image",
    id: `${file.name}-${file.lastModified}-${index}-${file.size}`,
    file,
    previewUrl: URL.createObjectURL(file),
    loaded: false,
    ratio: "1:1",
    transform: { ...initialTransform },
    zoom: 1,
    filter: "original",
    adjustments: { ...initialAdjustments },
    sourceSize: { width: 1, height: 1 },
  };
}

function loadSessionImage(
  session: ImageSession,
  onLoaded: (sessionId: string, img: HTMLImageElement) => void,
) {
  const img = new window.Image();
  img.onload = () => onLoaded(session.id, img);
  img.src = session.previewUrl;
  return img;
}

function drawVignette(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  amount: number,
) {
  if (amount <= 0) return;
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.hypot(cx, cy);
  const gradient = ctx.createRadialGradient(
    cx,
    cy,
    radius * 0.25,
    cx,
    cy,
    radius,
  );
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(1, `rgba(0,0,0,${amount * 0.72})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function drawTemperatureOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  temperature: number,
) {
  if (temperature === 0) return;
  ctx.save();
  ctx.globalCompositeOperation = "soft-light";
  const strength = (Math.abs(temperature) / 100) * 0.45;
  ctx.fillStyle =
    temperature > 0
      ? `rgba(255, 168, 70, ${strength})`
      : `rgba(70, 140, 255, ${strength})`;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function drawFadeOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  fade: number,
) {
  if (fade <= 0) return;
  ctx.fillStyle = `rgba(255,255,255,${fade * 0.28})`;
  ctx.fillRect(0, 0, width, height);
}

async function exportEditedImage(
  source: HTMLImageElement,
  session: ImageSession,
): Promise<File | null> {
  const { transform, file, sourceSize, filter, adjustments, ratio } = session;
  const sw = source.naturalWidth || sourceSize.width;
  const sh = source.naturalHeight || sourceSize.height;
  const aspect = getRatioValue(ratio, { width: sw, height: sh });
  const virtualW = sw;
  const virtualH = virtualW / aspect;
  const crop = getCoverLayout(virtualW, virtualH, sw, sh, transform).rect;

  if (crop.sWidth <= 0 || crop.sHeight <= 0) return null;

  const max = 2560;
  let outW = Math.round(crop.sWidth);
  let outH = Math.round(crop.sHeight);
  const cap = Math.min(1, max / Math.max(outW, outH));
  outW = Math.max(1, Math.round(outW * cap));
  outH = Math.max(1, Math.round(outH * cap));

  const out = document.createElement("canvas");
  out.width = outW;
  out.height = outH;
  const ctx = out.getContext("2d");
  if (!ctx) return null;

  ctx.filter = composeCssFilter(filter, adjustments);
  ctx.drawImage(
    source,
    crop.sx,
    crop.sy,
    crop.sWidth,
    crop.sHeight,
    0,
    0,
    outW,
    outH,
  );
  ctx.filter = "none";
  drawTemperatureOverlay(ctx, outW, outH, adjustments.temperature);
  drawFadeOverlay(ctx, outW, outH, adjustments.fade);
  drawVignette(ctx, outW, outH, adjustments.vignette / 100);

  const prefersPng = file.type === "image/png";
  const prefersJpeg = file.type === "image/jpeg" || file.type === "image/jpg";
  const exportType = prefersPng
    ? "image/png"
    : prefersJpeg
      ? "image/jpeg"
      : "image/webp";
  const exportExt = prefersPng ? "png" : prefersJpeg ? "jpg" : "webp";
  const exportQuality = prefersPng ? undefined : prefersJpeg ? 0.92 : 0.9;

  const blob = await new Promise<Blob | null>((resolve) =>
    out.toBlob(resolve, exportType, exportQuality),
  );
  const finalBlob =
    blob ??
    (await new Promise<Blob | null>((resolve) =>
      out.toBlob(resolve, "image/png"),
    ));

  if (!finalBlob) return null;

  return new File(
    [finalBlob],
    file.name.replace(/\.[^.]+$/, "") + `-framey.${exportExt}`,
    { type: finalBlob.type },
  );
}

export type ImageEditorHandle = {
  exportImages: () => Promise<void>;
  goBack: () => boolean;
};

type ImageEditorProps = {
  file?: File;
  files?: File[];
  onCancel?: () => void;
  onDone?: (media: EditedPostMedia[]) => void;
  onStageChange?: (stage: EditorStage) => void;
  showPrimaryButtons: boolean;
};

export const ImageEditor = forwardRef<ImageEditorHandle, ImageEditorProps>(
  function ImageEditor(
    { file, files, onCancel, onDone, onStageChange, showPrimaryButtons },
    ref,
  ) {
    const t = useT();
    const incomingFiles = useMemo(() => {
      const list = files?.length ? files : file ? [file] : [];
      return list.filter(
        (item) => item.size > 0 && (isImageFile(item) || isVideoFile(item)),
      );
    }, [file, files]);
    const availableRef = useRef<HTMLDivElement>(null);
    const cropFrameRef = useRef<HTMLDivElement>(null);
    const addInputRef = useRef<HTMLInputElement>(null);
    const sourcesRef = useRef<Map<string, HTMLImageElement>>(new Map());
    const sessionsRef = useRef<EditorSession[]>([]);
    const activeIndexRef = useRef(0);
    const pointers = useRef(new Map<number, { x: number; y: number }>());
    const gestureRef = useRef<{ distance: number; scale: number } | null>(null);
    const [sessions, setSessions] = useState<EditorSession[]>([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [ratio, setRatio] = useState<Ratio>("1:1");
    const [transform, setTransform] = useState<Transform>(initialTransform);
    const [zoom, setZoom] = useState(1);
    const [filter, setFilter] = useState<FilterName>("original");
    const [adjustments, setAdjustments] =
      useState<Adjustments>(initialAdjustments);
    const [stage, setStage] = useState<EditorStage>("crop");
    const [isDragging, setIsDragging] = useState(false);
    const [available, setAvailable] = useState({ width: 0, height: 0 });
    const [carouselApi, setCarouselApi] = useState<CarouselApi>();
    const sourceSize = useRef({ width: 1, height: 1 });
    const zoomRef = useRef(zoom);
    zoomRef.current = zoom;

    activeIndexRef.current = activeIndex;
    const activeSession = sessions[activeIndex];
    const aspectSource =
      isImageSession(activeSession) && activeSession.loaded
        ? activeSession.sourceSize
        : isVideoSession(activeSession)
          ? {
              width: Math.max(1, activeSession.width),
              height: Math.max(1, activeSession.height),
            }
          : sourceSize.current;
    const aspect = getRatioValue(ratio, aspectSource);
    const viewport = getContainedViewport(
      available.width,
      available.height,
      aspect,
    );
    const frame = fitFrame(available.width, available.height, aspect);
    const allowMultiple = !showPrimaryButtons;

    const persistActiveSession = useCallback(() => {
      const idx = activeIndexRef.current;
      const current = sessionsRef.current[idx];
      if (!current) return;

      const updated = isImageSession(current)
        ? {
            ...current,
            ratio,
            transform,
            zoom,
            filter,
            adjustments,
            sourceSize: current.loaded
              ? current.sourceSize
              : { ...sourceSize.current },
          }
        : { ...current, ratio };

      const next = [...sessionsRef.current];
      next[idx] = updated;
      sessionsRef.current = next;
      setSessions(next);
    }, [adjustments, filter, ratio, transform, zoom]);

    const applySession = useCallback((session: EditorSession) => {
      setRatio(session.ratio);
      if (!isImageSession(session)) return;
      setTransform(session.transform);
      setZoom(session.zoom);
      setFilter(session.filter);
      setAdjustments(session.adjustments);
      sourceSize.current = { ...session.sourceSize };
    }, []);

    const selectSession = useCallback(
      (index: number) => {
        if (index === activeIndexRef.current) return;
        persistActiveSession();
        activeIndexRef.current = index;
        setActiveIndex(index);
        applySession(sessionsRef.current[index]!);
      },
      [applySession, persistActiveSession],
    );

    useEffect(() => {
      const wrap = availableRef.current;
      if (!wrap) return;

      const update = () => {
        setAvailable({
          width: wrap.clientWidth,
          height: wrap.clientHeight,
        });
      };

      update();
      const observer = new ResizeObserver(update);
      observer.observe(wrap);
      window.addEventListener("resize", update);
      return () => {
        observer.disconnect();
        window.removeEventListener("resize", update);
      };
    }, [stage, ratio]);

    useEffect(() => {
      sessionsRef.current.forEach((session) => {
        if (isVideoSession(session)) revokeVideoSession(session);
        else URL.revokeObjectURL(session.previewUrl);
      });
      sourcesRef.current.clear();

      if (incomingFiles.length === 0) {
        sessionsRef.current = [];
        setSessions([]);
        return;
      }

      let disposed = false;

      void (async () => {
        const initialSessions: EditorSession[] = [];
        for (const [index, item] of incomingFiles.entries()) {
          if (isVideoFile(item)) {
            initialSessions.push(await loadVideoSession(item, index));
          } else {
            initialSessions.push(createImageSession(item, index));
          }
        }
        if (disposed) {
          initialSessions.forEach((session) => {
            if (isVideoSession(session)) revokeVideoSession(session);
            else URL.revokeObjectURL(session.previewUrl);
          });
          return;
        }

        sessionsRef.current = initialSessions;
        setSessions(initialSessions);
        setActiveIndex(0);
        activeIndexRef.current = 0;
        setRatio("1:1");
        setTransform(initialTransform);
        setZoom(1);
        setFilter("original");
        setAdjustments(initialAdjustments);
        setStage("crop");
        sourceSize.current = { width: 1, height: 1 };

        initialSessions.forEach((session) => {
          if (!isImageSession(session)) return;
          loadSessionImage(session, (sessionId, img) => {
            if (disposed) return;
            sourcesRef.current.set(sessionId, img);
            sessionsRef.current = sessionsRef.current.map((entry) =>
              isImageSession(entry) && entry.id === sessionId
                ? {
                    ...entry,
                    loaded: true,
                    sourceSize: {
                      width: img.naturalWidth,
                      height: img.naturalHeight,
                    },
                  }
                : entry,
            );
            setSessions([...sessionsRef.current]);

            const active = sessionsRef.current[activeIndexRef.current];
            if (active?.id === sessionId && isImageSession(active)) {
              sourceSize.current = {
                width: img.naturalWidth,
                height: img.naturalHeight,
              };
            }
          });
        });
      })();

      return () => {
        disposed = true;
        sessionsRef.current.forEach((session) => {
          if (isVideoSession(session)) revokeVideoSession(session);
          else URL.revokeObjectURL(session.previewUrl);
        });
        sourcesRef.current.clear();
      };
    }, [incomingFiles]);

    useEffect(() => {
      onStageChange?.(stage);
    }, [onStageChange, stage]);

    useEffect(() => {
      if (!carouselApi) return;

      const onSelect = () => {
        selectSession(carouselApi.selectedScrollSnap());
      };

      carouselApi.on("select", onSelect);
      return () => {
        carouselApi.off("select", onSelect);
      };
    }, [carouselApi, selectSession]);

    useEffect(() => {
      if (!carouselApi) return;
      carouselApi.reInit();
    }, [carouselApi, sessions.length, available.width, available.height]);

    const addFiles = (nextFiles: File[]) => {
      const acceptedKind = nextFiles.filter(
        (item) => item.size > 0 && (isImageFile(item) || isVideoFile(item)),
      );
      if (acceptedKind.length === 0) return;

      persistActiveSession();
      const room = Math.max(0, MAX_MEDIA - sessionsRef.current.length);
      const accepted = acceptedKind.slice(0, room);
      if (accepted.length === 0) return;

      const startIndex = sessionsRef.current.length;

      void (async () => {
        const newSessions: EditorSession[] = [];
        for (const [index, item] of accepted.entries()) {
          if (isVideoFile(item)) {
            newSessions.push(await loadVideoSession(item, startIndex + index));
          } else {
            newSessions.push(createImageSession(item, startIndex + index));
          }
        }

        sessionsRef.current = [...sessionsRef.current, ...newSessions];
        setSessions([...sessionsRef.current]);

        newSessions.forEach((session) => {
          if (!isImageSession(session)) return;
          loadSessionImage(session, (sessionId, img) => {
            sourcesRef.current.set(sessionId, img);
            const nextSize = {
              width: img.naturalWidth,
              height: img.naturalHeight,
            };
            sessionsRef.current = sessionsRef.current.map((entry) =>
              isImageSession(entry) && entry.id === sessionId
                ? {
                    ...entry,
                    loaded: true,
                    sourceSize: nextSize,
                  }
                : entry,
            );
            setSessions([...sessionsRef.current]);

            const active = sessionsRef.current[activeIndexRef.current];
            if (active?.id === sessionId && isImageSession(active)) {
              sourceSize.current = nextSize;
            }
          });
        });

        requestAnimationFrame(() => carouselApi?.scrollTo(startIndex));
        selectSession(startIndex);
      })();
    };

    const patchActiveSession = useCallback(
      (patch: Partial<ImageSession> | Partial<VideoSession>) => {
        const idx = activeIndexRef.current;
        const current = sessionsRef.current[idx];
        if (!current) return;

        const next = [...sessionsRef.current];
        next[idx] = { ...current, ...patch } as EditorSession;
        sessionsRef.current = next;
        setSessions(next);
      },
      [],
    );

    const updateZoom = useCallback((userZoomValue: number) => {
      const nextZoom = clamp(userZoomValue, 1, 4);
      setZoom(nextZoom);
      setTransform((current) => {
        const next = { ...current, scale: nextZoom };
        const idx = activeIndexRef.current;
        const session = sessionsRef.current[idx];
        if (isImageSession(session)) {
          const updated = [...sessionsRef.current];
          updated[idx] = { ...session, transform: next, zoom: nextZoom };
          sessionsRef.current = updated;
        }
        return next;
      });
    }, []);

    useEffect(() => {
      const el = cropFrameRef.current;
      if (!el || stage !== "crop") return;

      const onWheel = (event: WheelEvent) => {
        event.preventDefault();
        updateZoom(zoomRef.current + (event.deltaY < 0 ? 0.08 : -0.08));
      };

      el.addEventListener("wheel", onWheel, { passive: false });
      return () => el.removeEventListener("wheel", onWheel);
    }, [stage, updateZoom]);

    const selectRatio = (item: Ratio) => {
      setRatio(item);
      if (isVideoSession(sessionsRef.current[activeIndexRef.current])) {
        patchActiveSession({ ratio: item });
        return;
      }
      const reset = { ...initialTransform };
      setTransform(reset);
      setZoom(1);
      patchActiveSession({
        ratio: item,
        transform: reset,
        zoom: 1,
      });
    };

    const panBy = (dx: number, dy: number) => {
      if (viewport.width <= 0 || viewport.height <= 0) return;
      const sw = sourceSize.current.width;
      const sh = sourceSize.current.height;
      if (sw <= 1 || sh <= 1) return;

      setTransform((current) => {
        const box = getCoverLayout(
          viewport.width,
          viewport.height,
          sw,
          sh,
          current,
        );
        const nextLeft = clamp(box.left + dx, -box.extraX, 0);
        const nextTop = clamp(box.top + dy, -box.extraY, 0);
        const offsetX =
          box.extraX === 0 ? 0 : clamp(-nextLeft / (box.extraX / 2) - 1, -1, 1);
        const offsetY =
          box.extraY === 0 ? 0 : clamp(-nextTop / (box.extraY / 2) - 1, -1, 1);
        return { ...current, offsetX, offsetY };
      });
    };

    const goToEdit = useCallback(() => {
      persistActiveSession();
      setStage("edit");
    }, [persistActiveSession]);

    const goBack = useCallback(() => {
      if (stage !== "edit") return false;
      persistActiveSession();
      setStage("crop");
      return true;
    }, [persistActiveSession, stage]);

    const exportImage = useCallback(async () => {
      if (stage === "crop") {
        goToEdit();
        return;
      }

      persistActiveSession();
      const list = sessionsRef.current;
      if (list.length === 0) return;

      const exported: EditedPostMedia[] = [];
      for (const session of list) {
        if (isVideoSession(session)) {
          exported.push(await videoSessionToDraft(session));
          continue;
        }

        const source = sourcesRef.current.get(session.id);
        if (!source || !session.loaded) continue;
        const output = await exportEditedImage(source, session);
        if (output) exported.push({ file: output });
      }

      if (exported.length === 0) return;
      onDone?.(exported);
    }, [goToEdit, onDone, persistActiveSession, stage]);

    useImperativeHandle(
      ref,
      () => ({
        exportImages: exportImage,
        goBack,
      }),
      [exportImage, goBack],
    );

    const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
      if (
        stage !== "crop" ||
        event.button !== 0 ||
        !isImageSession(sessionsRef.current[activeIndexRef.current])
      )
        return;
      event.currentTarget.setPointerCapture(event.pointerId);
      pointers.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
      setIsDragging(true);

      if (pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()];
        gestureRef.current = {
          distance: Math.max(
            1,
            Math.hypot((a?.x ?? 0) - (b?.x ?? 0), (a?.y ?? 0) - (b?.y ?? 0)),
          ),
          scale: zoom,
        };
      }
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
      if (stage !== "crop" || event.buttons === 0) {
        if (event.buttons === 0) {
          pointers.current.clear();
          gestureRef.current = null;
          setIsDragging(false);
        }
        return;
      }

      const prev = pointers.current.get(event.pointerId);
      if (!prev) return;
      pointers.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });

      if (pointers.current.size === 2 && gestureRef.current) {
        const [a, b] = [...pointers.current.values()];
        updateZoom(
          (gestureRef.current.scale *
            Math.hypot((a?.x ?? 0) - (b?.x ?? 0), (a?.y ?? 0) - (b?.y ?? 0))) /
            gestureRef.current.distance,
        );
        return;
      }

      if (pointers.current.size === 1) {
        panBy(event.clientX - prev.x, event.clientY - prev.y);
      }
    };

    const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
      pointers.current.delete(event.pointerId);
      gestureRef.current = null;
      if (pointers.current.size === 0) {
        setIsDragging(false);
        persistActiveSession();
      }
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    };

    const overlayClassName =
      "rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur-sm";

    return (
      <section
        className="relative w-full min-w-0 max-w-full overflow-hidden bg-background"
        aria-label={t("imageEditor")}
      >
        {showPrimaryButtons && (
          <div className="flex items-center justify-between border-b px-3 py-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                if (!goBack()) onCancel?.();
              }}
            >
              <ArrowLeft aria-label={t("back")} className="rtl:rotate-180" />
            </Button>
            <Button
              type="button"
              variant="link"
              className="text-primary"
              onClick={() => void exportImage()}
              disabled={!activeSession?.loaded}
            >
              {stage === "crop" ? t("next") : t("done")}
            </Button>
          </div>
        )}

        <div className="flex w-full min-w-0 max-w-full overflow-hidden">
          <div className="min-w-0 flex-1">
            <div
              ref={availableRef}
              className="relative aspect-square w-full overflow-hidden bg-muted"
            >
              <Carousel
                className="size-full min-w-0 overflow-hidden"
                opts={{ watchDrag: false }}
                setApi={setCarouselApi}
              >
                <CarouselContent className="ml-0 h-full">
                  {sessions.map((session, index) => {
                    if (isVideoSession(session)) {
                      const sessionAspect = getRatioValue(
                        index === activeIndex ? ratio : session.ratio,
                        {
                          width: Math.max(1, session.width),
                          height: Math.max(1, session.height),
                        },
                      );
                      return (
                        <CarouselItem
                          key={session.id}
                          className="h-full min-w-0 pl-0"
                        >
                          <div className="relative flex size-full items-center justify-center">
                            <div
                              className="relative overflow-hidden bg-black"
                              style={{
                                width: `${Math.min(100, sessionAspect * 100)}%`,
                                height: `${Math.min(100, 100 / Math.max(sessionAspect, 0.01))}%`,
                              }}
                            >
                              <VideoClipPane
                                stage={stage}
                                active={index === activeIndex}
                                session={
                                  index === activeIndex &&
                                  isVideoSession(activeSession)
                                    ? activeSession
                                    : session
                                }
                              />
                            </div>
                          </div>
                        </CarouselItem>
                      );
                    }

                    const sessionTransform =
                      index === activeIndex ? transform : session.transform;
                    const sessionFilter =
                      index === activeIndex ? filter : session.filter;
                    const sessionAdjustments =
                      index === activeIndex ? adjustments : session.adjustments;
                    const sessionAspect = getRatioValue(
                      index === activeIndex ? ratio : session.ratio,
                      session.loaded
                        ? session.sourceSize
                        : { width: 1, height: 1 },
                    );
                    const sessionViewport = getContainedViewport(
                      available.width,
                      available.height,
                      sessionAspect,
                    );
                    const box = getCoverLayout(
                      sessionViewport.width || frame.width,
                      sessionViewport.height || frame.height,
                      session.sourceSize.width,
                      session.sourceSize.height,
                      sessionTransform,
                    );
                    const showEffects = stage === "edit";

                    return (
                      <CarouselItem
                        key={session.id}
                        className="h-full min-w-0 pl-0"
                      >
                        <div className="relative flex size-full items-center justify-center">
                          <div
                            ref={
                              index === activeIndex ? cropFrameRef : undefined
                            }
                            className={cn(
                              "relative overflow-hidden bg-background touch-none select-none",
                              stage === "crop" &&
                                "cursor-grab active:cursor-grabbing",
                            )}
                            style={{
                              width: `${Math.min(100, sessionAspect * 100)}%`,
                              height: `${Math.min(100, 100 / Math.max(sessionAspect, 0.01))}%`,
                            }}
                            onPointerDown={
                              index === activeIndex
                                ? handlePointerDown
                                : undefined
                            }
                            onPointerMove={
                              index === activeIndex
                                ? handlePointerMove
                                : undefined
                            }
                            onPointerUp={
                              index === activeIndex ? endDrag : undefined
                            }
                            onPointerCancel={
                              index === activeIndex ? endDrag : undefined
                            }
                          >
                            {session.loaded &&
                              session.sourceSize.width > 1 &&
                              box.width > 0 && (
                                <Image
                                  src={session.previewUrl}
                                  alt={session.file.name}
                                  width={Math.max(1, Math.round(box.width))}
                                  height={Math.max(1, Math.round(box.height))}
                                  unoptimized
                                  draggable={false}
                                  className="absolute max-w-none select-none"
                                  style={{
                                    width: box.width,
                                    height: box.height,
                                    left: box.left,
                                    top: box.top,
                                    filter: showEffects
                                      ? composeCssFilter(
                                          sessionFilter,
                                          sessionAdjustments,
                                        )
                                      : undefined,
                                  }}
                                />
                              )}
                            {showEffects && (
                              <>
                                <div
                                  className="pointer-events-none absolute inset-0 mix-blend-soft-light"
                                  style={{
                                    backgroundColor:
                                      sessionAdjustments.temperature === 0
                                        ? "transparent"
                                        : sessionAdjustments.temperature > 0
                                          ? `rgba(255, 168, 70, ${(Math.abs(sessionAdjustments.temperature) / 100) * 0.45})`
                                          : `rgba(70, 140, 255, ${(Math.abs(sessionAdjustments.temperature) / 100) * 0.45})`,
                                  }}
                                />
                                <div
                                  className="pointer-events-none absolute inset-0 bg-foreground"
                                  style={{
                                    opacity:
                                      (sessionAdjustments.fade * 0.28) / 100,
                                  }}
                                />
                                <div
                                  className="pointer-events-none absolute inset-0"
                                  style={{
                                    background: `radial-gradient(circle, transparent 35%, rgba(0,0,0,${(sessionAdjustments.vignette * 0.72) / 100}) 100%)`,
                                  }}
                                />
                              </>
                            )}
                            {index === activeIndex && (
                              <div
                                className={cn(
                                  "pointer-events-none absolute inset-0 transition-opacity duration-150",
                                  stage === "crop" && isDragging
                                    ? "opacity-100"
                                    : "opacity-0",
                                )}
                              >
                                <div className="absolute inset-y-0 left-1/3 w-px bg-foreground/70" />
                                <div className="absolute inset-y-0 left-2/3 w-px bg-foreground/70" />
                                <div className="absolute inset-x-0 top-1/3 h-px bg-foreground/70" />
                                <div className="absolute inset-x-0 top-2/3 h-px bg-foreground/70" />
                              </div>
                            )}
                          </div>
                        </div>
                      </CarouselItem>
                    );
                  })}
                </CarouselContent>
                {sessions.length > 1 && (
                  <>
                    <CarouselPrevious
                      variant="secondary"
                      size="icon"
                      className={cn(overlayClassName, "left-3 z-20 disabled:opacity-0")}
                    />
                    <CarouselNext
                      variant="secondary"
                      size="icon"
                      className={cn(overlayClassName, "right-3 z-20 disabled:opacity-0")}
                    />
                  </>
                )}
              </Carousel>

              {stage === "crop" && (
                <div className="absolute inset-x-0 bottom-3 z-10 flex items-center justify-between px-3">
                  <div className="flex items-center gap-2">
                    <Tooltip>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <TooltipTrigger
                              render={
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="secondary"
                                  className={overlayClassName}
                                >
                                  <ChevronExpandY
                                    size={18}
                                    className="rotate-45"
                                  />
                                  <span className="sr-only">Crop size</span>
                                </Button>
                              }
                            />
                          }
                        />
                        <DropdownMenuContent
                          side="top"
                          align="start"
                          className="min-w-40"
                        >
                          <DropdownMenuRadioGroup
                            value={ratio}
                            onValueChange={(value) =>
                              selectRatio(value as Ratio)
                            }
                          >
                            <DropdownMenuGroup>
                              {ratios.map((item) => (
                                <DropdownMenuRadioItem key={item} value={item}>
                                  {item === "original" ? t("original") : item}
                                </DropdownMenuRadioItem>
                              ))}
                            </DropdownMenuGroup>
                          </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <TooltipContent>{t("selectCrop")}</TooltipContent>
                    </Tooltip>

                    {isImageSession(activeSession) && (
                      <Tooltip>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <TooltipTrigger
                                render={
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="secondary"
                                    className={overlayClassName}
                                  >
                                    <SearchZoomIn size={18} />
                                    <span className="sr-only">Zoom</span>
                                  </Button>
                                }
                              />
                            }
                          />
                          <DropdownMenuContent
                            side="top"
                            align="start"
                            className="w-52 p-3"
                          >
                            <div className="flex flex-col gap-2 py-1">
                              <Slider
                                min={1}
                                max={4}
                                step={0.01}
                                value={[zoom]}
                                onValueChange={(value) =>
                                  updateZoom(
                                    Array.isArray(value)
                                      ? (value[0] ?? 1)
                                      : value,
                                  )
                                }
                              />
                            </div>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <TooltipContent>{t("selectZoom")}</TooltipContent>
                      </Tooltip>
                    )}
                  </div>

                  {allowMultiple && (
                    <Tooltip>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <TooltipTrigger
                              render={
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="secondary"
                                  className={overlayClassName}
                                >
                                  <Library size={18} />
                                  <span className="sr-only">
                                    {t("selectedImages")}
                                  </span>
                                </Button>
                              }
                            />
                          }
                        />
                        <DropdownMenuContent
                          side="top"
                          align="end"
                          className="w-auto min-w-0 p-2"
                        >
                          <DropdownMenuGroup>
                            <div className="flex items-center gap-2">
                              {sessions.map((session, index) => (
                                <Button
                                  key={session.id}
                                  type="button"
                                  variant="ghost"
                                  className={cn(
                                    "relative size-14 overflow-hidden rounded-md p-0",
                                    activeIndex === index &&
                                      "ring-2 ring-primary",
                                  )}
                                  disabled={!session.loaded}
                                  onClick={() => {
                                    selectSession(index);
                                    carouselApi?.scrollTo(index);
                                  }}
                                >
                                  <Image
                                    src={
                                      isVideoSession(session)
                                        ? (session.filmstrip[0] ??
                                          session.previewUrl)
                                        : session.previewUrl
                                    }
                                    alt={session.file.name}
                                    fill
                                    unoptimized
                                    className="object-cover"
                                  />
                                </Button>
                              ))}
                              {sessions.length < MAX_MEDIA && (
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="outline"
                                  className="size-14"
                                  onClick={() => addInputRef.current?.click()}
                                >
                                  <Plus />
                                  <span className="sr-only">
                                    {t("addPhotoOrVideo")}
                                  </span>
                                </Button>
                              )}
                            </div>
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <TooltipContent>{t("openMediaGallery")}</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              )}
            </div>
          </div>

          <aside
            aria-hidden={stage !== "edit"}
            inert={stage !== "edit"}
            className={cn(
              "shrink-0 overflow-hidden transition-[width] duration-300 ease-out motion-reduce:transition-none",
              stage === "edit" ? "w-72" : "w-0",
            )}
          >
            <div
              className={cn(
                "flex h-full w-72 shrink-0 flex-col border-l bg-background transition-transform duration-300 ease-out motion-reduce:transition-none",
                stage === "edit" ? "translate-x-0" : "-translate-x-full",
              )}
            >
              {isVideoSession(activeSession) ? (
                <div
                  className={cn(
                    "flex h-full min-h-0 flex-col transition-opacity duration-300 ease-out motion-reduce:transition-none",
                    stage === "edit"
                      ? "opacity-100 delay-300"
                      : "opacity-0 delay-0 duration-150",
                  )}
                >
                  <VideoEditSidebar
                    session={activeSession}
                    onChange={(patch) => patchActiveSession(patch)}
                  />
                </div>
              ) : (
                <Tabs
                  defaultValue="filters"
                  className={cn(
                    "flex min-h-0 flex-1 py-2 transition-opacity duration-300 ease-out motion-reduce:transition-none",
                    stage === "edit"
                      ? "opacity-100 delay-300"
                      : "opacity-0 delay-0 duration-150",
                  )}
                >
                  <TabsList
                    variant="line"
                    className="w-full justify-start rounded-none px-3"
                  >
                    <TabsTrigger value="filters">{t("filters")}</TabsTrigger>
                    <TabsTrigger value="adjustments">{t("adjustments")}</TabsTrigger>
                  </TabsList>
                  <TabsContent
                    value="filters"
                    className="min-h-0 overflow-y-auto p-3"
                  >
                    <div className="grid grid-cols-3 gap-3">
                      {filterNames.map((name) => {
                        const preview = activeSession?.previewUrl;
                        const selected = filter === name;
                        return (
                          <Button
                            key={name}
                            type="button"
                            variant="ghost"
                            className={cn(
                              "h-auto flex-col gap-1.5 p-1",
                              selected && "bg-muted",
                            )}
                            onClick={() => {
                              setFilter(name);
                              patchActiveSession({ filter: name });
                            }}
                          >
                            {preview && (
                              <span className="relative aspect-square w-full overflow-hidden rounded-md">
                                <Image
                                  src={preview}
                                  alt=""
                                  fill
                                  unoptimized
                                  className="object-cover"
                                  style={{
                                    filter: composeCssFilter(
                                      name,
                                      initialAdjustments,
                                    ),
                                  }}
                                />
                              </span>
                            )}
                            <span className="text-xs capitalize">{name}</span>
                          </Button>
                        );
                      })}
                    </div>
                  </TabsContent>
                  <TabsContent
                    value="adjustments"
                    className="min-h-0 overflow-y-auto p-4"
                  >
                    <FieldGroup className="gap-5">
                      {ADJUSTMENT_FIELDS.map((field) => (
                        <Field key={field.key}>
                          <div className="flex items-center justify-between">
                            <FieldLabel>{t(field.label)}</FieldLabel>
                            <span className="text-xs text-muted-foreground">
                              {adjustments[field.key]}
                            </span>
                          </div>
                          <Slider
                            min={field.min}
                            max={field.max}
                            step={1}
                            value={[adjustments[field.key]]}
                            onValueChange={(value) => {
                              const next = Array.isArray(value)
                                ? (value[0] ?? 0)
                                : value;
                              const nextAdjustments = {
                                ...adjustments,
                                [field.key]: next,
                              };
                              setAdjustments(nextAdjustments);
                              patchActiveSession({
                                adjustments: nextAdjustments,
                              });
                            }}
                          />
                        </Field>
                      ))}
                    </FieldGroup>
                  </TabsContent>
                </Tabs>
              )}
            </div>
          </aside>
        </div>

        <input
          ref={addInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(event) => {
            addFiles(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
      </section>
    );
  },
);
