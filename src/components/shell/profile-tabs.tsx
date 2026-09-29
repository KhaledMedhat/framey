"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Add,
  Bookmark,
  Camera,
  ChevronLeft,
  Grid,
  MoreH,
  Repeat3,
  TagUser,
  Trash,
  VideoSquare,
} from "reicon-react";

import type { FeedPost } from "@/interfaces/post.interface";
import { isVideoType } from "@/lib/files";
import type { Saved } from "@/server/profile";
import {
  useCreateCollectionMutation,
  useDeleteCollectionMutation,
  type ApiError,
} from "@/store/api";
import { useLang, useT } from "../i18n-provider";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Input } from "../ui/input";
import { Spinner } from "../ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { toast } from "../ui/toast";
import ProfileGrid from "./profile-grid";

const ALL = "all";

/**
 * The profile's grids behind shadcn tabs, switched in place (no URL). Saved
 * shows only on your own profile: All posts plus your named collections.
 */
export default function ProfileTabs({
  isMe,
  name,
  posts,
  reels,
  reposts,
  tagged,
  saved,
}: {
  isMe: boolean;
  /** "you" on your own profile, their first name otherwise. */
  name: string;
  posts: FeedPost[];
  reels: FeedPost[];
  reposts: FeedPost[];
  tagged: FeedPost[];
  saved: Saved | null;
}) {
  const router = useRouter();
  const t = useT();
  const lang = useLang();
  // null: the collection tiles; ALL or a collection id: that grid.
  const [openId, setOpenId] = useState<string | null>(null);
  const [naming, setNaming] = useState(false);
  const [newName, setNewName] = useState("");
  const [createCollection, { isLoading: creating }] =
    useCreateCollectionMutation();
  const [deleteCollection] = useDeleteCollectionMutation();

  const collection = saved?.collections.find((c) => c.id === openId);
  const savedPosts = collection
    ? (saved?.posts ?? []).filter((p) => collection.postIds.includes(p.id))
    : (saved?.posts ?? []);

  const create = async () => {
    const result = await createCollection({ name: newName.trim() });
    if ("error" in result) {
      toast.add({
        type: "error",
        description:
          (result.error as ApiError).data?.message ??
          t("collectionCreateFailed"),
      });
      return;
    }
    setNewName("");
    setNaming(false);
    setOpenId(result.data.id);
    router.refresh();
  };

  const remove = async (id: string) => {
    const result = await deleteCollection(id);
    if ("error" in result) {
      toast.add({
        type: "error",
        description: t("collectionDeleteFailed"),
      });
      return;
    }
    setOpenId(null);
    router.refresh();
  };

  return (
    <Tabs defaultValue="posts" className="mt-6 gap-0 md:mt-8">
      <TabsList
        variant="line"
        className="h-12 w-full justify-center gap-10 rounded-none border-b p-0 md:gap-16"
      >
        <TabsTrigger value="posts" className="flex-none gap-2 px-1">
          <Grid aria-hidden size={22} />
          <span className="sr-only md:not-sr-only">{t("postsLabel")}</span>
        </TabsTrigger>
        <TabsTrigger value="reels" className="flex-none gap-2 px-1">
          <VideoSquare aria-hidden size={22} />
          <span className="sr-only md:not-sr-only">{t("reels")}</span>
        </TabsTrigger>
        <TabsTrigger value="reposts" className="flex-none gap-2 px-1">
          <Repeat3 aria-hidden size={22} />
          <span className="sr-only md:not-sr-only">{t("reposts")}</span>
        </TabsTrigger>
        {saved && (
          <TabsTrigger value="saved" className="flex-none gap-2 px-1">
            <Bookmark aria-hidden size={22} />
            <span className="sr-only md:not-sr-only">{t("saved")}</span>
          </TabsTrigger>
        )}
        <TabsTrigger value="tagged" className="flex-none gap-2 px-1">
          <TagUser aria-hidden size={22} />
          <span className="sr-only md:not-sr-only">{t("tagged")}</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="posts" className="pt-1">
        {posts.length ? (
          <ProfileGrid posts={posts} />
        ) : (
          <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
            <Camera aria-hidden className="size-12 text-muted-foreground" />
            <h2 className="text-xl font-bold tracking-tight">
              {isMe ? t("shareFirstMoment") : t("noPostsYet")}
            </h2>
            <p className="max-w-xs text-sm text-pretty text-muted-foreground">
              {isMe ? t("noPostsMine") : t("noPostsTheirs", { name })}
            </p>
          </div>
        )}
      </TabsContent>

      <TabsContent value="reels" className="pt-1">
        {reels.length ? (
          <ProfileGrid posts={reels} />
        ) : (
          <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
            <VideoSquare
              aria-hidden
              className="size-12 text-muted-foreground"
            />
            <h2 className="text-xl font-bold tracking-tight">
              {t("noReelsYet")}
            </h2>
            <p className="max-w-xs text-sm text-pretty text-muted-foreground">
              {t("noReelsBody")}
            </p>
          </div>
        )}
      </TabsContent>

      <TabsContent value="reposts" className="pt-1">
        {reposts.length ? (
          <ProfileGrid posts={reposts} />
        ) : (
          <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
            <Repeat3 aria-hidden className="size-12 text-muted-foreground" />
            <h2 className="text-xl font-bold tracking-tight">
              {t("noRepostsYet")}
            </h2>
            <p className="max-w-xs text-sm text-pretty text-muted-foreground">
              {isMe ? t("noRepostsMine") : t("noRepostsTheirs", { name })}
            </p>
          </div>
        )}
      </TabsContent>

      {saved && (
        <TabsContent value="saved" className="flex flex-col gap-4 pt-3">
          {openId === null ? (
            <>
              <div className="flex items-center justify-between gap-4 px-4 md:px-0">
                <p className="text-xs text-muted-foreground">
                  {t("onlyYouSaved")}
                </p>
                <Dialog
                  open={naming}
                  onOpenChange={(next) => {
                    if (creating) return;
                    setNaming(next);
                    if (!next) setNewName("");
                  }}
                >
                  <DialogTrigger
                    render={
                      <Button variant="link" size="sm" className="px-0" />
                    }
                  >
                    <Add aria-hidden data-icon="inline-start" />
                    {t("newCollection")}
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-sm p-4">
                    <DialogHeader>
                      <DialogTitle>{t("newCollection")}</DialogTitle>
                    </DialogHeader>
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (newName.trim()) void create();
                      }}
                      className="flex items-center gap-4"
                    >
                      <Input
                        autoFocus
                        value={newName}
                        onChange={(event) => setNewName(event.target.value)}
                        maxLength={50}
                        placeholder={t("collectionName")}
                        aria-label={t("collectionName")}
                        disabled={creating}
                      />
                      <Button
                        type="submit"
                        disabled={!newName.trim() || creating}
                      >
                        {creating ? <Spinner /> : t("create")}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-6 px-4 md:grid-cols-3 md:px-0 lg:grid-cols-4">
                {[
                  {
                    id: ALL,
                    name: t("allPosts"),
                    postIds: saved.posts.map((p) => p.id),
                  },
                  ...saved.collections,
                ].map((c) => (
                  <li key={c.id}>
                    <Button
                      variant="ghost"
                      onClick={() => setOpenId(c.id)}
                      className="group h-auto w-full flex-col items-stretch gap-2 p-0 text-start hover:bg-transparent!"
                    >
                      <span className="grid aspect-square grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden rounded-lg bg-muted transition-opacity duration-150 group-hover:opacity-85 motion-reduce:transition-none">
                        {saved.posts
                          .filter((p) => c.postIds.includes(p.id))
                          .slice(0, 4)
                          .map((p) => {
                            const first = p.media[0];
                            const src = isVideoType(first?.type)
                              ? first?.cover?.url
                              : first?.url;
                            return (
                              <span key={p.id} className="relative bg-muted">
                                {src && (
                                  <Image
                                    src={src}
                                    alt=""
                                    fill
                                    sizes="(min-width: 1024px) 12vw, (min-width: 768px) 16vw, 25vw"
                                    className="object-cover"
                                  />
                                )}
                              </span>
                            );
                          })}
                      </span>
                      <span className="flex flex-col">
                        <span className="truncate text-sm font-semibold">
                          {c.name}
                        </span>
                        <span className="text-xs font-normal text-muted-foreground tabular-nums">
                          {c.postIds.length.toLocaleString(lang)}{" "}
                          {t(c.postIds.length === 1 ? "post" : "posts")}
                        </span>
                      </span>
                    </Button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 px-2 md:px-0">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("backToCollections")}
                  onClick={() => setOpenId(null)}
                >
                  <ChevronLeft aria-hidden className="size-5 rtl:rotate-180" />
                </Button>
                <h2 className="min-w-0 flex-1 truncate font-semibold">
                  {collection?.name ?? t("allPosts")}
                </h2>
                {collection && (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("collectionOptions", {
                            name: collection.name,
                          })}
                        />
                      }
                    >
                      <MoreH aria-hidden size={20} weight="Filled" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52 p-1.5">
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => void remove(collection.id)}
                        className="h-10 gap-3 px-3"
                      >
                        <Trash aria-hidden size={20} />
                        {t("deleteCollection")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              {savedPosts.length ? (
                // Remount per collection so an open viewer doesn't outlive its list.
                <ProfileGrid key={openId} posts={savedPosts} />
              ) : (
                <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
                  <Bookmark
                    aria-hidden
                    className="size-12 text-muted-foreground"
                  />
                  <h2 className="text-xl font-bold tracking-tight">
                    {collection
                      ? t("nothingInCollection", { name: collection.name })
                      : t("savePostsForLater")}
                  </h2>
                  <p className="max-w-xs text-sm text-pretty text-muted-foreground">
                    {collection
                      ? t("collectionEmptyBody")
                      : t("savedEmptyBody")}
                  </p>
                </div>
              )}
            </>
          )}
        </TabsContent>
      )}

      <TabsContent value="tagged" className="pt-1">
        {tagged.length ? (
          <ProfileGrid posts={tagged} />
        ) : (
          <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
            <TagUser aria-hidden className="size-12 text-muted-foreground" />
            <h2 className="text-xl font-bold tracking-tight">
              {isMe ? t("photosOfYou") : t("photosOf", { name })}
            </h2>
            <p className="max-w-xs text-sm text-pretty text-muted-foreground">
              {isMe ? t("taggedEmptyMine") : t("taggedEmptyTheirs", { name })}
            </p>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
