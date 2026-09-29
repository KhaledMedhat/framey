"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight2,
  ArrowSwapHorizontal,
  Calendar,
  Camera,
  Clock,
  Comment,
  Copy,
  Edit,
  Eye,
  Gallery,
  Grid,
  Heart,
  Link2,
  Repeat3,
  Reply,
  TickCircle,
  User,
  UserAdd,
  VideoPlay,
  VideoSquare,
  type IconComponent,
} from "reicon-react";

import type { DictKey } from "@/lib/i18n";
import { cn, timeAgo } from "@/lib/utils";
import type { AccountEvent, ActivityFilter, ActivityItem } from "@/server/activity";
import type { AccountEventKind } from "@/server/db/schema";
import {
  useArchivePostMutation,
  useDeleteCommentMutation,
  useDeleteHighlightMutation,
  useDeletePostMutation,
  useSetLikeMutation,
  useSetRepostMutation,
  useUnsendMessageMutation,
} from "@/store/api";
import { useLang, useT } from "../i18n-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Spinner } from "../ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { toast } from "../ui/toast";

type Section = "interactions" | "photosAndVideos" | "accountHistory";

const SECTIONS: {
  value: Section;
  description: DictKey;
  icon: IconComponent;
}[] = [
  { value: "interactions", description: "interactionsBody", icon: ArrowSwapHorizontal },
  { value: "photosAndVideos", description: "photosAndVideosBody", icon: Gallery },
  { value: "accountHistory", description: "accountHistoryBody", icon: Calendar },
];

const tabClass =
  "flex-none gap-2 px-5 py-2 text-xs font-semibold tracking-wider uppercase after:hidden data-active:text-foreground";

/**
 * Your activity: the sections on the side, the open one beside them (on a
 * phone, the list first and then the section). Everything is loaded up
 * front, so switching sections and tabs never waits on the server.
 */
export function YourActivity({
  filter,
  likes,
  comments,
  reposts,
  storyReplies,
  posts,
  reels,
  highlights,
  history,
}: {
  filter: ActivityFilter;
  likes: ActivityItem[];
  comments: ActivityItem[];
  reposts: ActivityItem[];
  storyReplies: ActivityItem[];
  posts: ActivityItem[];
  reels: ActivityItem[];
  highlights: ActivityItem[];
  history: AccountEvent[];
}) {
  const t = useT();
  const [section, setSection] = useState<Section>("interactions");
  // Phones show one pane at a time: the list until a section is picked.
  const [picked, setPicked] = useState(false);
  const key = `${filter.sort}-${filter.from}-${filter.to}`;

  return (
    <div className="flex min-h-[calc(100svh-3.5rem-env(safe-area-inset-bottom))] flex-col md:min-h-[calc(100svh-4rem)] md:flex-row md:rounded-lg md:border">
      <aside
        className={cn(
          "w-full shrink-0 flex-col md:flex md:w-60 md:border-e",
          picked ? "hidden" : "flex",
        )}
      >
        <h1 className="border-b px-4 py-4 text-base font-bold">{t("yourActivity")}</h1>
        <nav aria-label={t("yourActivity")}>
          <ul className="flex flex-col">
            {SECTIONS.map(({ value, description, icon: Icon }) => {
              const active = section === value;
              return (
                <li key={value}>
                  <button
                    type="button"
                    aria-current={active ? "page" : undefined}
                    onClick={() => {
                      setSection(value);
                      setPicked(true);
                    }}
                    className={cn(
                      "flex w-full gap-4 border-s-2 border-transparent px-4 py-3.5 text-start transition-colors duration-150 hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none",
                      active && "md:border-foreground",
                    )}
                  >
                    <Icon aria-hidden size={26} className="mt-0.5 shrink-0" />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className={cn("text-sm", active && "md:font-semibold")}>{t(value)}</span>
                      <span className="text-xs text-pretty text-muted-foreground">
                        {t(description)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      <section className={cn("min-w-0 flex-1 flex-col md:flex", picked ? "flex" : "hidden")}>
        <div className="flex items-center gap-2 border-b px-2 py-2 md:hidden">
          <Button variant="ghost" size="icon" aria-label={t("back")} onClick={() => setPicked(false)}>
            <ArrowLeft aria-hidden className="size-5 rtl:rotate-180" />
          </Button>
          <h2 className="text-base font-semibold">{t(section)}</h2>
        </div>

        {section === "interactions" && (
          <Tabs defaultValue="likes" className="min-h-0 flex-1 gap-0">
            <TabsList
              variant="line"
              className="h-auto w-full justify-start gap-2 overflow-x-auto rounded-none px-4 py-3 md:px-8"
            >
              <TabsTrigger value="likes" className={tabClass}>
                <Heart aria-hidden className="size-4" />
                {t("likesTab")}
              </TabsTrigger>
              <TabsTrigger value="comments" className={tabClass}>
                <Comment aria-hidden className="size-4" />
                {t("commentsTab")}
              </TabsTrigger>
              <TabsTrigger value="reposts" className={tabClass}>
                <Repeat3 aria-hidden className="size-4" />
                {t("reposts")}
              </TabsTrigger>
              <TabsTrigger value="storyReplies" className={tabClass}>
                <Reply aria-hidden className="size-4" />
                {t("storyReplies")}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="likes" className="flex flex-col">
              <ActivityPanel key={key} kind="likes" items={likes} filter={filter} />
            </TabsContent>
            <TabsContent value="comments" className="flex flex-col">
              <ActivityPanel key={key} kind="comments" items={comments} filter={filter} />
            </TabsContent>
            <TabsContent value="reposts" className="flex flex-col">
              <ActivityPanel key={key} kind="reposts" items={reposts} filter={filter} />
            </TabsContent>
            <TabsContent value="storyReplies" className="flex flex-col">
              <ActivityPanel key={key} kind="storyReplies" items={storyReplies} filter={filter} />
            </TabsContent>
          </Tabs>
        )}

        {section === "photosAndVideos" && (
          <Tabs defaultValue="posts" className="min-h-0 flex-1 gap-0">
            <TabsList
              variant="line"
              className="h-auto w-full justify-center gap-2 overflow-x-auto rounded-none px-4 py-3 md:px-8"
            >
              <TabsTrigger value="posts" className={tabClass}>
                <Grid aria-hidden className="size-4" />
                {t("postsLabel")}
              </TabsTrigger>
              <TabsTrigger value="reels" className={tabClass}>
                <VideoSquare aria-hidden className="size-4" />
                {t("reels")}
              </TabsTrigger>
              <TabsTrigger value="highlights" className={tabClass}>
                <Clock aria-hidden className="size-4" />
                {t("highlightsTab")}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="posts" className="flex flex-col">
              <ActivityPanel key={key} kind="posts" items={posts} filter={filter} />
            </TabsContent>
            <TabsContent value="reels" className="flex flex-col">
              <ActivityPanel key={key} kind="reels" items={reels} filter={filter} />
            </TabsContent>
            <TabsContent value="highlights" className="flex flex-col">
              <ActivityPanel key={key} kind="highlights" items={highlights} filter={filter} />
            </TabsContent>
          </Tabs>
        )}

        {section === "accountHistory" && (
          <AccountHistory key={key} events={history} filter={filter} />
        )}
      </section>
    </div>
  );
}

/**
 * "Newest to oldest" and the Sort & filter dialog: order, and a day range.
 * Choices go to the URL, so the server page re-reads them.
 */
function SortFilter({ filter }: { filter: ActivityFilter }) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(filter);

  const apply = (next: ActivityFilter) => {
    const query = new URLSearchParams(params);
    for (const key of ["sort", "from", "to"] as const) {
      const value = next[key];
      if (value && !(key === "sort" && value === "newest")) query.set(key, value);
      else query.delete(key);
    }
    router.push(`${pathname}?${query}`);
    setOpen(false);
  };

  return (
    <>
      <h2 className="text-base font-bold">
        {filter.sort === "oldest" ? t("oldestToNewest") : t("newestToOldest")}
      </h2>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setDraft(filter);
          setOpen(true);
        }}
        className="font-semibold"
      >
        {t("sortAndFilter")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-4 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("sortAndFilter")}</DialogTitle>
          </DialogHeader>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-semibold">{t("sortBy")}</legend>
            {(["newest", "oldest"] as const).map((sort) => (
              <label key={sort} className="flex items-center justify-between text-sm">
                {sort === "newest" ? t("newestToOldest") : t("oldestToNewest")}
                <input
                  type="radio"
                  name="sort"
                  checked={draft.sort === sort}
                  onChange={() => setDraft((d) => ({ ...d, sort }))}
                  className="size-4 accent-foreground"
                />
              </label>
            ))}
          </fieldset>
          <fieldset className="grid grid-cols-2 gap-2">
            <legend className="mb-2 text-sm font-semibold">{t("dateRange")}</legend>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {t("startDate")}
              <Input
                type="date"
                value={draft.from ?? ""}
                max={draft.to}
                onChange={(event) => setDraft((d) => ({ ...d, from: event.target.value || undefined }))}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {t("endDate")}
              <Input
                type="date"
                value={draft.to ?? ""}
                min={draft.from}
                onChange={(event) => setDraft((d) => ({ ...d, to: event.target.value || undefined }))}
              />
            </label>
          </fieldset>
          <DialogFooter className="m-0 grid grid-cols-2 gap-2 p-0">
            <Button variant="secondary" onClick={() => apply({ sort: "newest" })}>
              {t("reset")}
            </Button>
            <Button onClick={() => apply(draft)}>{t("apply")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export type ActivityKind =
  | "likes"
  | "comments"
  | "reposts"
  | "storyReplies"
  | "posts"
  | "reels"
  | "highlights";

const EMPTY: Record<ActivityKind, DictKey> = {
  likes: "noLikesActivity",
  comments: "noCommentsActivity",
  reposts: "noRepostsActivity",
  storyReplies: "noStoryRepliesActivity",
  posts: "noPostsActivity",
  reels: "noReelsActivity",
  highlights: "noHighlightsActivity",
};

/**
 * One activity tab: the toolbar, then tiles (posts) or rows (comments and
 * story replies). Select picks several; the bar at the foot acts on them all.
 */
export function ActivityPanel({
  kind,
  items,
  filter,
}: {
  kind: ActivityKind;
  items: ActivityItem[];
  filter: ActivityFilter;
}) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<"primary" | "archive" | null>(null);
  const [working, setWorking] = useState(false);
  const [setLike] = useSetLikeMutation();
  const [setRepost] = useSetRepostMutation();
  const [deleteComment] = useDeleteCommentMutation();
  const [unsend] = useUnsendMessageMutation();
  const [archivePost] = useArchivePostMutation();
  const [deletePost] = useDeletePostMutation();
  const [deleteHighlight] = useDeleteHighlightMutation();
  const list = kind === "comments" || kind === "storyReplies";
  const chosen = items.filter((item) => picked.includes(item.id));

  const primary: DictKey =
    kind === "likes"
      ? "unlike"
      : kind === "reposts"
        ? "removeRepost"
        : "delete";

  const run = async (action: "primary" | "archive") => {
    setWorking(true);
    const results = await Promise.all(
      chosen.map((item) => {
        if (action === "archive") return archivePost({ postId: item.id, archived: true });
        switch (kind) {
          case "likes":
            return setLike({ postId: item.id, liked: false });
          case "reposts":
            return setRepost({ postId: item.id, reposted: false });
          case "comments":
            return deleteComment({ id: item.id, postId: item.postId! });
          case "storyReplies":
            return unsend({ id: item.id, conversationId: item.conversationId! });
          case "highlights":
            return deleteHighlight(item.id);
          default:
            return deletePost(item.id);
        }
      }),
    );
    setWorking(false);
    setConfirm(null);
    const failed = results.filter((r) => "error" in r).length;
    if (failed) toast.add({ type: "error", description: t("someActionsFailed", { count: String(failed) }) });
    setPicked([]);
    setSelecting(false);
    router.refresh();
  };

  const toggle = (id: string) =>
    setPicked((ids) => (ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 px-4 py-3 md:px-6">
        <SortFilter filter={filter} />
        {items.length > 0 && (
          <Button
            variant="link"
            size="sm"
            onClick={() => {
              setSelecting((s) => !s);
              setPicked([]);
            }}
            className="ms-auto text-blue-500"
          >
            {selecting ? t("cancel") : t("select")}
          </Button>
        )}
      </div>

      {!items.length ? (
        <p className="px-6 py-20 text-center text-sm text-muted-foreground">{t(EMPTY[kind])}</p>
      ) : list ? (
        <ul className="flex flex-col px-2 pb-24 md:px-4">
          {items.map((item) => {
            const on = picked.includes(item.id);
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  onClick={(event) => {
                    if (!selecting) return;
                    event.preventDefault();
                    toggle(item.id);
                  }}
                  aria-pressed={selecting ? on : undefined}
                  className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors duration-150 hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none"
                >
                  <span className="relative size-14 shrink-0 overflow-hidden rounded-md bg-muted">
                    {item.thumb && (
                      <Image src={item.thumb} alt="" fill sizes="56px" className="object-cover" />
                    )}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col text-sm">
                    <span className="text-xs text-muted-foreground">
                      {kind === "comments"
                        ? t("commentedOn", { name: item.meta ?? "" })
                        : t("repliedToStoryOf", { name: item.meta ?? "" })}
                      {" · "}
                      {timeAgo(item.createdAt, lang, t("timeNow"))}
                    </span>
                    <span className="line-clamp-2 break-words">{item.text}</span>
                  </span>
                  {selecting && (
                    <TickCircle
                      aria-hidden
                      weight={on ? "Filled" : "Outline"}
                      className={cn("size-6 shrink-0", !on && "text-muted-foreground")}
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="grid grid-cols-3 gap-0.5 px-0 pb-24 md:px-6">
          {items.map((item) => {
            const on = picked.includes(item.id);
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  onClick={(event) => {
                    if (!selecting) return;
                    event.preventDefault();
                    toggle(item.id);
                  }}
                  aria-pressed={selecting ? on : undefined}
                  aria-label={item.text ?? t("openPost")}
                  className="group relative block aspect-square overflow-hidden bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  {item.thumb && (
                    <Image
                      src={item.thumb}
                      alt=""
                      fill
                      sizes="(min-width: 768px) 220px, 33vw"
                      className={cn("object-cover transition-opacity", selecting && !on && "opacity-80")}
                    />
                  )}
                  {kind === "highlights" && item.text && (
                    <span className="absolute inset-x-0 bottom-0 truncate bg-linear-to-t from-black/60 to-transparent px-2 pt-6 pb-1.5 text-xs font-semibold text-white">
                      {item.text}
                    </span>
                  )}
                  <span className="pointer-events-none absolute end-2 top-2 text-white drop-shadow-sm">
                    {selecting ? (
                      <TickCircle aria-hidden weight={on ? "Filled" : "Outline"} className="size-6" />
                    ) : item.multiple ? (
                      <Copy aria-label={t("carousel")} className="size-5" />
                    ) : item.video ? (
                      <VideoPlay aria-label={t("video")} weight="Filled" className="size-5" />
                    ) : null}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {selecting && (
        <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] mt-auto flex items-center gap-2 border-t bg-background px-4 py-3 md:bottom-0 md:px-6">
          <p className="text-sm font-semibold">{t("selectedCount", { count: String(picked.length) })}</p>
          {(kind === "posts" || kind === "reels") && (
            <Button
              variant="secondary"
              size="sm"
              disabled={!picked.length}
              onClick={() => setConfirm("archive")}
              className="ms-auto"
            >
              {t("archive")}
            </Button>
          )}
          <Button
            variant="destructive"
            size="sm"
            disabled={!picked.length}
            onClick={() => setConfirm("primary")}
            className={cn(kind !== "posts" && kind !== "reels" && "ms-auto")}
          >
            {t(primary)}
          </Button>
        </div>
      )}

      <AlertDialog open={confirm !== null} onOpenChange={(next) => !working && !next && setConfirm(null)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t(confirm === "archive" ? "archiveSelectedTitle" : "actOnSelectedTitle", {
                count: String(picked.length),
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "archive" ? t("archiveSelectedBody") : t(`${primary}SelectedBody` as DictKey)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant={confirm === "archive" ? "default" : "destructive"}
              disabled={working}
              onClick={() => void run(confirm ?? "primary")}
            >
              {working ? <Spinner /> : t(confirm === "archive" ? "archive" : primary)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const EVENT: Record<AccountEventKind, { icon: IconComponent; title: DictKey; set: DictKey; cleared: DictKey }> = {
  created: { icon: UserAdd, title: "historyCreated", set: "historyCreatedBody", cleared: "historyCreatedBody" },
  name: { icon: User, title: "historyName", set: "historyNameSet", cleared: "historyNameSet" },
  username: { icon: User, title: "username", set: "historyUsernameSet", cleared: "historyUsernameSet" },
  bio: { icon: Edit, title: "historyBio", set: "historyBioSet", cleared: "historyBioCleared" },
  website: { icon: Link2, title: "historyWebsite", set: "historyWebsiteSet", cleared: "historyWebsiteCleared" },
  gender: { icon: User, title: "historyGender", set: "historyGenderSet", cleared: "historyGenderCleared" },
  privacy: { icon: Eye, title: "historyPrivacy", set: "historyPrivacySet", cleared: "historyPrivacySet" },
  photo: { icon: Camera, title: "historyPhoto", set: "historyPhotoSet", cleared: "historyPhotoSet" },
};

/** Account history: each profile change, newest (or oldest) first. */
export function AccountHistory({
  events,
  filter,
}: {
  events: AccountEvent[];
  filter: ActivityFilter;
}) {
  const t = useT();
  const lang = useLang();
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col items-center gap-1 border-b px-6 py-6 text-center">
        <h2 className="text-sm font-semibold">{t("aboutAccountHistory")}</h2>
        <p className="text-sm text-muted-foreground">{t("accountHistoryBody")}</p>
      </div>
      <div className="flex items-center gap-3 px-4 py-3 md:px-6">
        <SortFilter filter={filter} />
      </div>
      {!events.length ? (
        <p className="px-6 py-20 text-center text-sm text-muted-foreground">{t("noAccountHistory")}</p>
      ) : (
        <ul className="flex flex-col pb-10">
          {events.map((event) => {
            const { icon: Icon, title, set, cleared } = EVENT[event.kind];
            const value =
              event.kind === "privacy"
                ? t(event.value === "private" ? "privateWord" : "publicWord")
                : (event.value ?? "");
            // Each entry: what changed, then the details (to what, and when).
            return (
              <li key={event.id}>
                {event.kind === "created" ? (
                  <div className="flex items-center gap-4 px-4 py-4 md:px-6">
                    <Icon aria-hidden size={26} className="mt-0.5 shrink-0 self-start" />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
                      <span className="text-base font-semibold">{t(title)}</span>
                      <span className="text-muted-foreground">
                        {t(set, {
                          date: new Date(event.createdAt).toLocaleDateString(lang, {
                            dateStyle: "long",
                          }),
                        })}
                      </span>
                      <time
                        dateTime={event.createdAt}
                        className="text-xs text-muted-foreground"
                        suppressHydrationWarning
                      >
                        {timeAgo(event.createdAt, lang, t("timeNow"))}
                      </time>
                    </span>
                  </div>
                ) : (
                  <Link
                    href={event.kind === "privacy" ? "/settings/privacy" : "/settings/edit-profile"}
                    className="flex items-center gap-4 px-4 py-4 transition-colors duration-150 hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none md:px-6"
                  >
                    <Icon aria-hidden size={26} className="mt-0.5 shrink-0 self-start" />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
                      <span className="text-base font-semibold">{t(title)}</span>
                      <span className="text-muted-foreground">
                        {t(event.value === null ? cleared : set)}
                      </span>
                      {event.kind !== "photo" && event.value !== null && (
                        <span dir="auto" className="line-clamp-3 font-semibold break-words text-foreground">
                          {value}
                        </span>
                      )}
                      <time
                        dateTime={event.createdAt}
                        title={new Date(event.createdAt).toLocaleString(lang)}
                        className="text-xs text-muted-foreground"
                        suppressHydrationWarning
                      >
                        {timeAgo(event.createdAt, lang, t("timeNow"))}
                      </time>
                    </span>
                    <ArrowRight2 aria-hidden className="size-5 shrink-0 text-muted-foreground rtl:rotate-180" />
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
