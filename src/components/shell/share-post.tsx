"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Autocomplete } from "@base-ui/react/autocomplete";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type z from "zod";
import { Globe, Location, Lock, TickCircle, X } from "reicon-react";

import { AccountVisibility } from "@/interfaces/general.interface";
import type { EditedPostMedia, PhotoTag } from "@/interfaces/post.interface";
import { isVideoFile } from "@/lib/files";
import { cn, getFullName } from "@/lib/utils";
import { postSchema } from "@/lib/validations";
import {
  useCreatePostMutation,
  useFollowListQuery,
  type ApiError,
} from "@/store/api";
import { FormVideoPreview, finalizeVideoMedia } from "../editors/video-editor";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { useT } from "../i18n-provider";
import { Button } from "../ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "../ui/carousel";
import { Input } from "../ui/input";
import { Spinner } from "../ui/spinner";
import { Switch } from "../ui/switch";
import { toast } from "../ui/toast";
import EmojiButton, { insertEmoji } from "./emoji-button";

export const SHARE_POST_FORM_ID = "share-post-form";
const CAPTION_MAX = 2200;
const TAGS_MAX = 20;

const shareSchema = postSchema.pick({
  caption: true,
  location: true,
  postImageAccessibility: true,
  hideComments: true,
  hidePostInfo: true,
});
type ShareValues = z.infer<typeof shareSchema>;

type Preview = { src: string; poster?: string; video: boolean };

const PHOTON_URL = "https://photon.komoot.io/api/";

type Place = {
  id: string;
  label: string;
  detail: string;
  lat: number;
  lng: number;
};
type PhotonFeature = {
  geometry: { coordinates: [lng: number, lat: number] };
  properties: {
    osm_type?: string;
    osm_id?: number;
    type?: string;
    name?: string;
    city?: string;
    state?: string;
    country?: string;
  };
};

/** "Cairo Tower, Cairo, Egypt": name, then city (or state), then country. */
function toPlaces({ features }: { features: PhotonFeature[] }): Place[] {
  const seen = new Set<string>();
  return features.flatMap(({ geometry, properties: p }) => {
    const id = `${p.osm_type}${p.osm_id}`;
    if (!p.name || !/^[NWR]\d+$/.test(id) || seen.has(id)) return [];
    seen.add(id);
    const region =
      p.city ??
      (p.type === "state" || p.type === "country" ? undefined : p.state);
    const parts = [p.name, region, p.country].filter(
      (part, i, all): part is string => !!part && all.indexOf(part) === i,
    );
    const [lng, lat] = geometry.coordinates;
    return [
      {
        id,
        label: parts.join(", "),
        detail: [
          p.type && p.type[0]!.toUpperCase() + p.type.slice(1),
          p.state !== region ? p.state : undefined,
        ]
          .filter(Boolean)
          .join(" · "),
        lat,
        lng,
      },
    ];
  });
}

const pill =
  "rounded-full border-0 bg-background/80 text-foreground shadow-sm backdrop-blur-sm";

/**
 * The last step of Create: caption, location, alt text and the two post
 * switches beside the finished frames. Submits through the dialog header's
 * Share button (`form={SHARE_POST_FORM_ID}`).
 */
export default function SharePost({
  media,
  onSharingChange,
  onShared,
}: {
  media: EditedPostMedia[];
  onSharingChange: (sharing: boolean) => void;
  onShared: () => void;
}) {
  const router = useRouter();
  const t = useT();
  const { data: session } = useSession();
  const user = session?.user;
  const [createPost] = useCreatePostMutation();
  const [status, setStatus] = useState<string | null>(null);
  const captionRef = useRef<HTMLTextAreaElement | null>(null);
  const [shared, setShared] = useState(false);

  const form = useForm<ShareValues>({
    resolver: zodResolver(shareSchema),
    defaultValues: {
      caption: "",
      location: "",
      postImageAccessibility: media.map(() => ({ alt: "" })),
      hideComments: false,
      hidePostInfo: false,
    },
  });
  const caption = useWatch({ control: form.control, name: "caption" }) ?? "";
  const location = useWatch({ control: form.control, name: "location" }) ?? "";
  // People tagged on the photos; `draft` is the spot waiting for a name.
  const [tags, setTags] = useState<PhotoTag[]>([]);
  const [draft, setDraft] = useState<Omit<PhotoTag, "userId" | "username"> | null>(null);
  const [tagQuery, setTagQuery] = useState("");
  const { data: following, isFetching: loadingFollowing } = useFollowListQuery(
    { username: user?.username ?? "", list: "following" },
    { skip: !draft || !user },
  );
  const tagMatches = (following ?? [])
    .filter(
      (a) =>
        !tags.some((t) => t.userId === a.id && t.mediaIndex === draft?.mediaIndex) &&
        `${a.username} ${getFullName(a.firstName, a.lastName)}`
          .toLowerCase()
          .includes(tagQuery.trim().toLowerCase()),
    )
    .slice(0, 6);
  const addTag = (account: { id: string; username: string }) => {
    if (!draft) return;
    setTags((t) => [...t, { ...draft, userId: account.id, username: account.username }]);
    setDraft(null);
  };
  // Photo width / height, so tags land on the photo, not its letterbox.
  const [ratios, setRatios] = useState<Record<number, number>>({});
  const [places, setPlaces] = useState<Place[]>([]);
  const [place, setPlace] = useState<Place | null>(null);

  // Photon suggestions, debounced; a picked place doesn't search again.
  useEffect(() => {
    const query = location.trim();
    if (query.length < 2 || query === place?.label) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `${PHOTON_URL}?q=${encodeURIComponent(query)}&limit=6&lang=en`,
          { signal: controller.signal },
        );
        if (response.ok) setPlaces(toPlaces(await response.json()));
      } catch {
        // Aborted or offline: the location simply stays free text.
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [location, place]);

  // Created and revoked in one effect: a memoized URL would be revoked by
  // strict mode's extra cleanup and never recreated.
  const [previews, setPreviews] = useState<Preview[]>([]);
  useEffect(() => {
    const next = media.map((item) => ({
      src: URL.createObjectURL(item.file),
      poster: item.cover && URL.createObjectURL(item.cover),
      video: isVideoFile(item.file),
    }));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- object URLs are an external resource
    setPreviews(next);
    return () => {
      for (const p of next) {
        URL.revokeObjectURL(p.src);
        if (p.poster) URL.revokeObjectURL(p.poster);
      }
    };
  }, [media]);

  const onSubmit = async (values: ShareValues) => {
    onSharingChange(true);
    try {
      // Videos are trimmed, cropped and compressed only now, at share time.
      const videoCount = media.filter((m) => m.needsCompress).length;
      const ready: EditedPostMedia[] = [];
      for (const item of media) {
        if (!item.needsCompress) {
          ready.push(item);
          continue;
        }
        const n = ready.filter((m) => isVideoFile(m.file)).length + 1;
        const label =
          videoCount > 1
            ? t("preparingVideoN", { n: String(n), total: String(videoCount) })
            : t("preparingVideo");
        setStatus(label);
        ready.push(
          await finalizeVideoMedia(item, (p) =>
            setStatus(`${label} · ${Math.round(p * 100)}%`),
          ),
        );
      }

      setStatus(t("sharing"));
      await createPost({
        post: {
          caption: values.caption,
          location: values.location,
          place:
            place && place.label === values.location?.trim()
              ? { id: place.id, lat: place.lat, lng: place.lng }
              : undefined,
          hideComments: values.hideComments,
          hidePostInfo: values.hidePostInfo,
          tags: tags.length ? tags : undefined,
          media: ready.map((item, i) => ({
            alt: values.postImageAccessibility?.[i]?.alt,
            muted: item.muted,
            duration: item.duration,
            hasCover: Boolean(item.cover),
          })),
        },
        files: ready.map((item) => item.file),
        covers: Object.fromEntries(
          ready.flatMap((item, i) => (item.cover ? [[i, item.cover]] : [])),
        ),
      }).unwrap();
    } catch (error) {
      setStatus(null);
      onSharingChange(false);
      toast.add({
        type: "error",
        description:
          error instanceof Error
            ? error.message
            : ((error as ApiError).data?.message ??
              t("postShareFailed")),
      });
      return;
    }

    setStatus(null);
    setShared(true);
    onSharingChange(false);
    router.refresh();
    onShared();
  };

  const first = previews[0];

  if (shared) {
    return (
      <div className="flex aspect-square max-h-[70svh] w-full flex-col items-center justify-center gap-5 px-6 text-center">
        {first && (
          <div className="relative size-28 animate-in overflow-hidden bg-muted duration-500 ease-out fade-in zoom-in-90 motion-reduce:animate-none">
            {/* eslint-disable-next-line @next/next/no-img-element -- blob URL */}
            <img
              src={first.video ? first.poster : first.src}
              alt=""
              className="size-full object-cover"
            />
          </div>
        )}
        <TickCircle
          aria-hidden
          weight="Filled"
          className="size-10 animate-in text-foreground delay-200 duration-300 fill-mode-both fade-in zoom-in-50 motion-reduce:animate-none"
        />
        <p role="status" className="text-base font-medium">
          {t("postHasBeenShared")}
        </p>
      </div>
    );
  }

  const thumb = (preview: Preview | undefined, className: string) =>
    preview && (
      // eslint-disable-next-line @next/next/no-img-element -- blob URL
      <img
        src={preview.video ? preview.poster : preview.src}
        alt=""
        className={cn("shrink-0 bg-muted object-cover", className)}
      />
    );

  return (
    <div className="grid md:grid-cols-[minmax(0,1fr)_18rem]">
      {/* The same square stage the editor used, so the frame doesn't move. */}
      <div className="relative hidden aspect-square bg-muted md:block">
        <Carousel
          className="size-full"
          opts={{ watchDrag: previews.length > 1 }}
        >
          <CarouselContent className="ml-0 h-full">
            {previews.map((preview, i) => (
              <CarouselItem key={preview.src} className="h-full min-w-0 pl-0">
                {preview.video ? (
                  <FormVideoPreview
                    src={preview.src}
                    poster={preview.poster}
                    muted={media[i]?.muted}
                    className="object-contain"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center">
                    <div
                      className="relative"
                      style={{
                        width: `${Math.min(1, ratios[i] ?? 1) * 100}%`,
                        height: `${Math.min(1, 1 / (ratios[i] ?? 1)) * 100}%`,
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- blob URL */}
                      <img
                        src={preview.src}
                        alt=""
                        onLoad={(event) => {
                          const { naturalWidth: w, naturalHeight: h } = event.currentTarget;
                          if (w && h) setRatios((r) => ({ ...r, [i]: w / h }));
                        }}
                        onClick={(event) => {
                          if (tags.length >= TAGS_MAX || status !== null) return;
                          const box = event.currentTarget.getBoundingClientRect();
                          setTagQuery("");
                          setDraft({
                            mediaIndex: i,
                            x: (event.clientX - box.left) / box.width,
                            y: (event.clientY - box.top) / box.height,
                          });
                        }}
                        className="size-full cursor-crosshair object-cover"
                      />
                      {tags
                        .filter((tag) => tag.mediaIndex === i)
                        .map((tag) => (
                          <span
                            key={tag.userId}
                            style={{ left: `${tag.x * 100}%`, top: `${tag.y * 100}%` }}
                            className="absolute flex -translate-x-1/2 items-center gap-0.5 rounded-md bg-black/80 py-0.5 pr-0.5 pl-2 text-xs font-semibold text-white"
                          >
                            {tag.username}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              aria-label={t("removeTagFor", { name: tag.username })}
                              onClick={() => setTags((list) => list.filter((x) => x !== tag))}
                              className="text-white hover:bg-white/15 hover:text-white"
                            >
                              <X aria-hidden />
                            </Button>
                          </span>
                        ))}
                      {draft?.mediaIndex === i && (
                        <div
                          style={{ left: `${draft.x * 100}%`, top: `${draft.y * 100}%` }}
                          onBlur={(event) => {
                            if (!event.currentTarget.contains(event.relatedTarget)) setDraft(null);
                          }}
                          className={cn(
                            "absolute z-30 flex w-60 flex-col gap-1 rounded-lg bg-popover p-1.5 text-popover-foreground shadow-md ring-1 ring-foreground/10",
                            draft.x > 0.5 && "-translate-x-full",
                            draft.y > 0.5 && "-translate-y-full",
                          )}
                        >
                          <Input
                            autoFocus
                            value={tagQuery}
                            onChange={(event) => setTagQuery(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Escape") {
                                event.stopPropagation();
                                setDraft(null);
                              } else if (event.key === "Enter") {
                                event.preventDefault();
                                if (tagMatches[0]) addTag(tagMatches[0]);
                              }
                            }}
                            aria-label={t("tagSomeone")}
                            placeholder={t("searchPeopleYouFollow")}
                          />
                          {loadingFollowing && !following ? (
                            <div className="flex h-12 items-center justify-center">
                              <Spinner />
                            </div>
                          ) : tagMatches.length ? (
                            <ul className="flex max-h-52 flex-col overflow-y-auto">
                              {tagMatches.map((account) => (
                                <li key={account.id}>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => addTag(account)}
                                    className="h-auto w-full justify-start gap-2.5 px-2 py-1.5 font-normal"
                                  >
                                    <Avatar size="sm">
                                      <AvatarImage src={account.profilePicture?.url} alt="" />
                                      <AvatarFallback>
                                        {account.username.slice(0, 2).toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="flex min-w-0 flex-col text-left">
                                      <span className="truncate text-sm font-semibold">
                                        {account.username}
                                      </span>
                                      <span className="truncate text-xs text-muted-foreground">
                                        {getFullName(account.firstName, account.lastName)}
                                      </span>
                                    </span>
                                  </Button>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                              {following?.length
                                ? t("noFollowMatches")
                                : t("followToTag")}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CarouselItem>
            ))}
          </CarouselContent>
          {previews.some((p) => !p.video) && !draft && (
            <p
              className={cn(
                pill,
                "pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2 px-3 py-1.5 text-xs font-medium",
              )}
            >
              {tags.length >= TAGS_MAX ? t("tagLimitReached") : t("clickToTag")}
            </p>
          )}
          {previews.length > 1 && (
            <>
              <CarouselPrevious
                variant="secondary"
                size="icon"
                className={cn(pill, "left-3 z-20 disabled:opacity-0")}
              />
              <CarouselNext
                variant="secondary"
                size="icon"
                className={cn(pill, "right-3 z-20 disabled:opacity-0")}
              />
            </>
          )}
        </Carousel>
      </div>

      <div className="relative min-h-0 md:border-s">
        <form
          id={SHARE_POST_FORM_ID}
          onSubmit={form.handleSubmit(onSubmit)}
          className="max-h-[calc(100svh-8rem)] overflow-y-auto md:absolute md:inset-0 md:max-h-none"
        >
          <fieldset disabled={status !== null} className="contents">
            {status !== null && (
              <p
                role="status"
                className="flex h-10 shrink-0 items-center gap-2 border-b bg-muted/50 px-4 text-xs text-muted-foreground tabular-nums"
              >
                <Spinner className="size-3.5" />
                {status}
              </p>
            )}
            <div className="flex flex-col gap-2.5 p-3">
              <div className="bg-muted/45 flex flex-col gap-2 rounded-lg p-3">
                <div className="flex items-center gap-2.5">
                  <Avatar size="sm">
                    <AvatarImage
                      src={user?.profilePicture?.url ?? undefined}
                      alt=""
                    />
                    <AvatarFallback>
                      {user
                        ? `${user.firstName[0]}${user.lastName[0] ?? ""}`
                        : ""}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 truncate text-sm font-semibold">
                    {user?.username}
                  </span>
                </div>
                <div className="flex gap-3">
                  {thumb(first, "size-16 md:hidden")}
                  <Controller
                    name="caption"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <textarea
                        {...field}
                        ref={(el) => {
                          field.ref(el);
                          captionRef.current = el;
                        }}
                        aria-label={t("caption")}
                        aria-invalid={fieldState.invalid}
                        maxLength={CAPTION_MAX}
                        placeholder={t("writeCaption")}
                        className="field-sizing-content min-h-24 w-full resize-none bg-transparent text-base leading-normal outline-none placeholder:text-muted-foreground md:min-h-32 md:text-sm"
                      />
                    )}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <EmojiButton
                    className="-ml-1.5"
                    onEmoji={(emoji) => {
                      const next = insertEmoji(captionRef.current, caption, emoji);
                      if (next.value.length > CAPTION_MAX) return;
                      form.setValue("caption", next.value, { shouldDirty: true });
                      requestAnimationFrame(() => {
                        captionRef.current?.focus();
                        captionRef.current?.setSelectionRange(next.caret, next.caret);
                      });
                    }}
                  />
                  <p
                    className={cn(
                      "text-xs text-muted-foreground tabular-nums",
                      caption.length >= CAPTION_MAX && "text-foreground",
                    )}
                  >
                    {caption.length.toLocaleString()}/
                    {CAPTION_MAX.toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="bg-muted/45 flex flex-col rounded-lg">
                <Controller
                  name="location"
                  control={form.control}
                  render={({ field }) => (
                    <Autocomplete.Root
                      items={
                        field.value && field.value.trim().length >= 2
                          ? places
                          : []
                      }
                      filter={null}
                      itemToStringValue={(item: Place) => item.label}
                      value={field.value ?? ""}
                      onValueChange={(value, { reason }) => {
                        field.onChange(value);
                        if (reason !== "item-press") setPlace(null);
                      }}
                    >
                      <label className="flex h-11 items-center gap-3 px-3">
                        <Location
                          aria-hidden
                          className="size-5 shrink-0 text-muted-foreground"
                        />
                        <Autocomplete.Input
                          name={field.name}
                          ref={field.ref}
                          onBlur={field.onBlur}
                          maxLength={512}
                          placeholder={t("addLocation")}
                          className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground md:text-sm"
                        />
                      </label>
                      <Autocomplete.Portal>
                        <Autocomplete.Positioner
                          sideOffset={4}
                          className="isolate z-50 outline-none"
                        >
                          <Autocomplete.Popup className="max-h-[min(20rem,var(--available-height))] w-(--anchor-width) origin-(--transform-origin) overflow-y-auto rounded-md bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none data-empty:hidden">
                            <Autocomplete.List>
                              {(item: Place) => (
                                <Autocomplete.Item
                                  key={item.id}
                                  value={item}
                                  onClick={() => setPlace(item)}
                                  className="flex cursor-default flex-col gap-0.5 rounded-sm px-2 py-2 text-sm outline-none select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                                >
                                  <span className="truncate">{item.label}</span>
                                  {item.detail && (
                                    <span className="truncate text-xs text-muted-foreground">
                                      {item.detail}
                                    </span>
                                  )}
                                </Autocomplete.Item>
                              )}
                            </Autocomplete.List>
                          </Autocomplete.Popup>
                        </Autocomplete.Positioner>
                      </Autocomplete.Portal>
                    </Autocomplete.Root>
                  )}
                />
                <p className="mx-3 flex min-h-11 items-center gap-3 border-t py-2.5 text-sm">
                  {user?.visibility === AccountVisibility.PRIVATE ? (
                    <Lock
                      aria-hidden
                      className="size-5 shrink-0 text-muted-foreground"
                    />
                  ) : (
                    <Globe
                      aria-hidden
                      className="size-5 shrink-0 text-muted-foreground"
                    />
                  )}
                  <span>
                    {user?.visibility === AccountVisibility.PRIVATE
                      ? t("onlyFollowersSeePost")
                      : t("anyoneSeesPost")}
                  </span>
                </p>
              </div>
              <div className="bg-muted/45 flex flex-col gap-2.5 rounded-lg p-3">
                <p className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{t("altText")}</span>
                  <span className="text-xs text-muted-foreground text-pretty">
                    {t("altTextBody")}
                  </span>
                </p>
                <ul className="flex flex-col gap-2">
                  {previews.map((preview, i) => (
                    <li key={preview.src} className="flex items-center gap-3">
                      {thumb(preview, "size-9")}
                      <input
                        {...form.register(`postImageAccessibility.${i}.alt`)}
                        aria-label={t(preview.video ? "altTextForVideo" : "altTextForPhoto", { n: String(i + 1) })}
                        maxLength={1000}
                        placeholder={t("writeAltText")}
                        className="h-9 min-w-0 flex-1 rounded-md border border-input bg-transparent px-2.5 text-base shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
                      />
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-muted/45 flex flex-col gap-3.5 rounded-lg p-3">
                {(
                  [
                    {
                      name: "hidePostInfo",
                      label: t("hideLikeCount"),
                      hint: t("hideLikeCountHint"),
                    },
                    {
                      name: "hideComments",
                      label: t("turnOffCommenting"),
                      hint: t("turnOffCommentingHint"),
                    },
                  ] as const
                ).map(({ name, label, hint }) => (
                  <Controller
                    key={name}
                    name={name}
                    control={form.control}
                    render={({ field }) => (
                      <label className="flex cursor-pointer items-start justify-between gap-4">
                        <span className="flex flex-col gap-1">
                          <span className="text-sm">{label}</span>
                          <span className="text-xs text-muted-foreground text-pretty">
                            {hint}
                          </span>
                        </span>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          className="mt-0.5"
                        />
                      </label>
                    )}
                  />
                ))}
              </div>
            </div>
          </fieldset>
        </form>
      </div>
    </div>
  );
}
