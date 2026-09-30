"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  AddSquare,
  ArrowLeft,
  Bookmark2,
  GalleryAdd,
  Heart,
  Home6,
  IconWeight,
  Logout,
  Menu,
  Moon,
  Profile2user,
  Search,
  Send,
  Setting2,
  Sun,
  VideoSquare,
  type IconComponent,
} from "reicon-react";

import type { DictKey } from "@/lib/i18n";
import type { EditedPostMedia } from "@/interfaces/post.interface";
import type { StoryOverlay } from "@/interfaces/story.interface";
import type { ProfilePicture } from "@/interfaces/user.interface";
import { cn, FEED_PATH } from "@/lib/utils";
import {
  useCreateStoryMutation,
  useUnreadChatsQuery,
  type ApiError,
} from "@/store/api";
import { ImageEditor, type ImageEditorHandle } from "../editors/image-editor";
import { finalizeVideoMedia } from "../editors/video-editor";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { toast } from "../ui/toast";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { useChatEvents } from "./chat";
import { NotificationsSheet, useNotifications } from "./notifications";
import { CREATE_STORY_EVENT, StoryTextStep } from "./stories";
import SharePost, { SHARE_POST_FORM_ID } from "./share-post";
import { SwitchAccountDialog } from "./switch-account";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { useTheme } from "next-themes";
import { useT } from "../i18n-provider";
import { StoryAudienceStep } from "./close-friends";

type Item = { href: string; label: DictKey; icon: IconComponent };
/** `fill`: the icon switches to its Filled weight when active; the rest thicken instead. */
type RailItem = Item & { fill?: IconWeight };

const RAIL: RailItem[] = [
  { href: FEED_PATH, label: "home", icon: Home6, fill: "Filled" },
  { href: "/reels", label: "reels", icon: VideoSquare, fill: "Filled" },
  { href: "/direct", label: "messages", icon: Send, fill: "Filled" },
  { href: "/search", label: "search", icon: Search },
];

// ponytail: toggles for this visit only; persisting it needs a pre-paint script in layout.
// function toggleAppearance() {
//   document.documentElement.classList.toggle("dark");
// }

/**
 * Desktop: an icon rail with tooltip labels, Create (dialog), Profile (avatar)
 * and a More menu. Mobile: a bottom tab bar
 * with the same Create, Profile and More.
 */
export default function Nav({
  username,
  user,
  logout,
}: {
  username: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    profilePicture: ProfilePicture | null;
  };
  logout: () => Promise<void>;
}) {
  const pathname = usePathname();
  const t = useT();
  const [createOpen, setCreateOpen] = useState(false);
  const [createFiles, setCreateFiles] = useState<File[]>([]);
  const [createStage, setCreateStage] = useState<"crop" | "edit">("crop");
  const [createMedia, setCreateMedia] = useState<EditedPostMedia[] | null>(
    null,
  );
  const [createSharing, setCreateSharing] = useState(false);
  const [createShared, setCreateShared] = useState(false);
  const [createKind, setCreateKind] = useState<"post" | "story">("post");
  /** An edited story waiting on its audience. */
  const [storyMedia, setStoryMedia] = useState<EditedPostMedia | null>(null);
  /** Text laid over the story, and whether the text step is done. */
  const [storyOverlays, setStoryOverlays] = useState<StoryOverlay[]>([]);
  const [storyTextDone, setStoryTextDone] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const unread = useNotifications(user?.id ?? "");
  useChatEvents(user?.id ?? "");
  const chatUnread = useUnreadChatsQuery(undefined, { skip: !user }).data?.inbox ?? 0;
  const [createStory] = useCreateStoryMutation();
  const router = useRouter();
  const editorRef = useRef<ImageEditorHandle>(null);
  const resetCreate = () => {
    setCreateFiles([]);
    setCreateStage("crop");
    setCreateMedia(null);
    setCreateShared(false);
    setCreateKind("post");
    setStoryMedia(null);
    setStoryOverlays([]);
    setStoryTextDone(false);
  };

  // "Your story" in the feed's tray opens Create in story mode.
  useEffect(() => {
    const open = () => {
      setCreateKind("story");
      setCreateOpen(true);
    };
    window.addEventListener(CREATE_STORY_EVENT, open);
    return () => window.removeEventListener(CREATE_STORY_EVENT, open);
  }, []);

  /** A story skips the caption step: pick who sees it and it uploads. */
  const shareStory = async (item: EditedPostMedia, closeFriends: boolean) => {
    setCreateSharing(true);
    try {
      const ready = await finalizeVideoMedia(item);
      await createStory({
        story: {
          muted: ready.muted,
          duration: ready.duration,
          hasCover: Boolean(ready.cover),
          closeFriends,
          overlays: storyOverlays,
        },
        file: ready.file,
        cover: ready.cover,
      }).unwrap();
    } catch (error) {
      setCreateSharing(false);
      toast.add({
        type: "error",
        description:
          error instanceof Error
            ? error.message
            : ((error as ApiError).data?.message ??
              t("storyShareFailed")),
      });
      return;
    }
    setCreateSharing(false);
    setCreateOpen(false);
    resetCreate();
    toast.add({ description: t("storyShared") });
    router.refresh();
  };

  const { setTheme, theme } = useTheme();
  // Page paths arrive encoded, so compare both forms of `/@me`.
  const isActive = (href: string) =>
    pathname === href || decodeURIComponent(pathname) === href;

  const itemClass = (active: boolean) =>
    cn(
      "flex size-11 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-muted/50 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none",
      active && "text-foreground",
    );

  const rail = RAIL.map((item) => ({ ...item, active: isActive(item.href) }));
  const profileActive = isActive(`/${username}`);

  return (
    <>
      {/* Desktop View */}
      <nav
        aria-label={t("mainNav")}
        className="fixed inset-y-0 left-0 z-40 hidden w-18 flex-col items-center justify-between bg-background py-5 md:flex"
      >
        <Link
          href={FEED_PATH}
          aria-label={t("frameyHome")}
          className="flex size-11 items-center justify-center rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {/* CSS picks the logo, so it's right on first paint in either theme. */}
          <Image
            src="/framey_black.png"
            alt=""
            width={100}
            height={100}
            className="h-auto w-8 dark:hidden"
          />
          <Image
            src="/framey_white.png"
            alt=""
            width={100}
            height={100}
            className="hidden h-auto w-8 dark:block"
          />
        </Link>

        <ul className="flex flex-col gap-2">
          {rail.map((item) => (
            <li key={item.href}>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Link
                      href={item.href}
                      aria-label={
                        item.href === "/direct" && chatUnread
                          ? `${t(item.label)}, ${chatUnread}`
                          : t(item.label)
                      }
                      aria-current={item.active ? "page" : undefined}
                      className={cn("relative", itemClass(item.active))}
                    >
                      <item.icon
                        aria-hidden
                        weight={item.active && item.fill ? "Filled" : "Outline"}
                        className="shrink-0"
                        size={24}
                      />
                      {item.href === "/direct" && chatUnread > 0 && (
                        <span className="absolute top-1 right-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-destructive px-1 text-[0.6875rem] leading-none font-semibold text-white tabular-nums ring-2 ring-background">
                          {chatUnread > 99 ? "99+" : chatUnread}
                        </span>
                      )}
                    </Link>
                  }
                />
                <TooltipContent side="right">{t(item.label)}</TooltipContent>
              </Tooltip>
            </li>
          ))}
          <li>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-lg"
                    aria-label={unread ? `${t("notifications")}, ${unread}` : t("notifications")}
                    aria-expanded={notificationsOpen}
                    onClick={() => setNotificationsOpen(true)}
                    className={cn("relative", itemClass(false))}
                  >
                    <Heart
                      aria-hidden
                      weight={notificationsOpen ? "Filled" : "Outline"}
                      className="shrink-0"
                      size={24}
                    />
                    {unread > 0 && (
                      <span className="absolute top-1 right-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-destructive px-1 text-[0.6875rem] leading-none font-semibold text-white tabular-nums ring-2 ring-background">
                        {unread > 99 ? "99+" : unread}
                      </span>
                    )}
                  </Button>
                }
              />
              <TooltipContent side="right">{t("notifications")}</TooltipContent>
            </Tooltip>
          </li>
          <li>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-lg"
                    aria-label={t("create")}
                    onClick={() => setCreateOpen(true)}
                    className={itemClass(false)}
                  >
                    <AddSquare aria-hidden className="shrink-0" size={24} />
                  </Button>
                }
              />
              <TooltipContent side="right">{t("create")}</TooltipContent>
            </Tooltip>
          </li>
          <li>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Link
                    href={`/${username}`}
                    aria-label={t("profile")}
                    aria-current={profileActive ? "page" : undefined}
                    className={itemClass(profileActive)}
                  >
                    <Avatar>
                      <AvatarImage
                        src={user?.profilePicture?.url ?? undefined}
                        alt=""
                      />
                      <AvatarFallback>
                        {user
                          ? `${user.firstName[0]}${user.lastName[0]}`
                          : username[0]}
                      </AvatarFallback>
                    </Avatar>
                  </Link>
                }
              />
              <TooltipContent side="right">{t("profile")}</TooltipContent>
            </Tooltip>
          </li>
        </ul>

        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger
              render={
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-lg"
                      aria-label={t("more")}
                      className={itemClass(false)}
                    />
                  }
                />
              }
            >
              <Menu aria-hidden className="size-6 shrink-0" />
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              {t("more")}
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent
            side="right"
            align="end"
            sideOffset={12}
            className="w-60 p-1.5"
          >
            {/* Desktop opens Settings on Edit profile; mobile on its list of sections. */}
            {(
              [
                { href: "/settings/edit-profile", label: "settings", icon: Setting2 },
                { href: "/your-activity", label: "yourActivity", icon: Activity },
                { href: `/${username}?tab=saved`, label: "saved", icon: Bookmark2 },
              ] satisfies Item[]
            ).map(({ href, label, icon: Icon }) => (
              <DropdownMenuItem
                key={href}
                render={<Link href={href} />}
                className="h-10 gap-3 px-3"
              >
                <Icon aria-hidden size={20} />
                {t(label)}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem
              onClick={() =>
                theme === "dark" ? setTheme("light") : setTheme("dark")
              }
              className="h-10 gap-3 px-3"
            >
              {theme === "dark" ? (
                <Moon aria-hidden size={20} />
              ) : (
                <Sun aria-hidden size={20} />
              )}
              {t("switchAppearance")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              render={
                <SwitchAccountDialog
                  className="w-full justify-start hover:bg-accent!"
                  switchAccountButtonIcon={Profile2user}
                  switchAccountButtonVariant="ghost"
                  switchAccountButtonLabel={t("switchAccounts")}
                />
              }
              className="h-10 gap-3 px-3"
            ></DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => void logout()}
              className="h-10 gap-3 px-3"
            >
              <Logout aria-hidden size={20} />
              {t("logOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>

      {/* Mobile View*/}
      <nav
        aria-label={t("mainNav")}
        className="fixed inset-x-0 bottom-0 z-40 flex h-14 items-center justify-around border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {rail
          .filter((item) => item.href === FEED_PATH || item.href === "/reels")
          .map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-label={t(item.label)}
              aria-current={item.active ? "page" : undefined}
              className={itemClass(item.active)}
            >
              <item.icon
                aria-hidden
                weight={item.active && item.fill ? "Filled" : "Outline"}
                className="shrink-0"
                size={24}
              />
            </Link>
          ))}
        <Button
          type="button"
          variant="ghost"
          aria-label={t("create")}
          onClick={() => setCreateOpen(true)}
          className={itemClass(false)}
        >
          <AddSquare aria-hidden size={24} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          aria-label={unread ? `${t("notifications")}, ${unread}` : t("notifications")}
          aria-expanded={notificationsOpen}
          onClick={() => setNotificationsOpen(true)}
          className={cn("relative", itemClass(false))}
        >
          <Heart
            aria-hidden
            weight={notificationsOpen ? "Filled" : "Outline"}
            className="shrink-0"
            size={24}
          />
          {unread > 0 && (
            <span className="absolute top-1 right-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-destructive px-1 text-[0.6875rem] leading-none font-semibold text-white tabular-nums ring-2 ring-background">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
        <Link
          href={`/${username}`}
          aria-label={t("profile")}
          aria-current={profileActive ? "page" : undefined}
          className={itemClass(profileActive)}
        >
          <Avatar>
            <AvatarImage src={user?.profilePicture?.url ?? undefined} alt="" />
            <AvatarFallback>
              {user ? `${user.firstName[0]}${user.lastName[0]}` : username[0]}
            </AvatarFallback>
          </Avatar>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-lg"
                aria-label={t("more")}
                className={itemClass(false)}
              />
            }
          >
            <Menu aria-hidden className="size-6 shrink-0" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align="end"
            sideOffset={12}
            className="w-60 p-1.5"
          >
            {(
              [
                { href: "/settings", label: "settings", icon: Setting2 },
                { href: "/your-activity", label: "yourActivity", icon: Activity },
                { href: `/${username}?tab=saved`, label: "saved", icon: Bookmark2 },
              ] satisfies Item[]
            ).map(({ href, label, icon: Icon }) => (
              <DropdownMenuItem
                key={href}
                render={<Link href={href} />}
                className="h-10 gap-3 px-3"
              >
                <Icon aria-hidden size={20} />
                {t(label)}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem
              onClick={() =>
                theme === "dark" ? setTheme("light") : setTheme("dark")
              }
              className="h-10 gap-3 px-3"
            >
              {theme === "dark" ? (
                <Moon aria-hidden size={20} />
              ) : (
                <Sun aria-hidden size={20} />
              )}
              {t("switchAppearance")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              render={
                <SwitchAccountDialog
                  className="w-full justify-start"
                  switchAccountButtonIcon={Profile2user}
                  switchAccountButtonVariant="ghost"
                  switchAccountButtonLabel={t("switchAccounts")}
                />
              }
              className="h-10 gap-3 px-3"
            ></DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => void logout()}
              className="h-10 gap-3 px-3"
            >
              <Logout aria-hidden size={20} />
              {t("logOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          // Stay open while the post uploads.
          if (!open && createSharing) return;
          setCreateOpen(open);
          if (!open) resetCreate();
        }}
      >
        <DialogContent
          className={cn(
            "gap-0 overflow-hidden p-0 transition-[max-width] duration-300 ease-out motion-reduce:transition-none",
            !createShared && (createStage === "edit" || createMedia)
              ? "max-w-[min(60rem,calc(100%-2rem))]!"
              : "sm:max-w-xl",
          )}
        >
          <DialogHeader className="relative h-12 flex-row items-center justify-center border-b px-4">
            {createFiles.length > 0 && !createSharing && !createShared && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t("back")}
                className="absolute start-2"
                onClick={() => {
                  if (createMedia) setCreateMedia(null);
                  else if (storyMedia && storyTextDone) setStoryTextDone(false);
                  else if (storyMedia) setStoryMedia(null);
                  else if (!editorRef.current?.goBack()) setCreateFiles([]);
                }}
              >
                <ArrowLeft aria-hidden className="rtl:rotate-180" />
              </Button>
            )}
            <DialogTitle className="text-center">
              {createShared
                ? t("postShared")
                : createSharing
                  ? t("sharing")
                  : storyMedia
                    ? t("yourStory")
                    : createMedia
                    ? t("newPost")
                    : createFiles.length === 0
                      ? createKind === "story"
                        ? t("createNewStory")
                        : t("createNewPost")
                      : createStage === "crop"
                        ? t("crop")
                        : t("edit")}
            </DialogTitle>
            {createMedia && !createShared ? (
              <Button
                type="submit"
                form={SHARE_POST_FORM_ID}
                variant="link"
                disabled={createSharing}
                className="absolute end-2 text-primary"
              >
                {t("share")}
              </Button>
            ) : (
              createFiles.length > 0 &&
              !createShared &&
              !storyMedia && (
                <Button
                  type="button"
                  variant="link"
                  className="absolute end-2 text-primary"
                  onClick={() => void editorRef.current?.exportImages()}
                >
                  {createStage === "crop" ? t("next") : t("done")}
                </Button>
              )
            )}
          </DialogHeader>
          {createFiles.length > 0 ? (
            <>
              {/* Kept mounted behind the share step so Back returns to the edits. */}
              <div className={cn((createMedia || storyMedia) && "hidden")}>
                <ImageEditor
                  ref={editorRef}
                  files={createFiles}
                  showPrimaryButtons={false}
                  onStageChange={setCreateStage}
                  onDone={(media) =>
                    createKind === "story"
                      ? setStoryMedia(media[0] ?? null)
                      : setCreateMedia(media)
                  }
                />
              </div>
              {storyMedia && !storyTextDone && (
                <StoryTextStep
                  media={storyMedia}
                  overlays={storyOverlays}
                  onChange={setStoryOverlays}
                  onNext={() => setStoryTextDone(true)}
                />
              )}
              {storyMedia && storyTextDone && (
                <StoryAudienceStep
                  sharing={createSharing}
                  onShare={(closeFriends) =>
                    void shareStory(storyMedia, closeFriends)
                  }
                />
              )}
              {createMedia && (
                <SharePost
                  media={createMedia}
                  onSharingChange={setCreateSharing}
                  onShared={() => {
                    setCreateShared(true);
                    setTimeout(() => {
                      setCreateOpen(false);
                      resetCreate();
                    }, 2400);
                  }}
                />
              )}
            </>
          ) : (
            <div
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const files = [...event.dataTransfer.files];
                setCreateFiles(createKind === "story" ? files.slice(0, 1) : files);
              }}
              className="flex aspect-square flex-col items-center justify-center gap-5 px-6 text-center"
            >
              <Tabs
                value={createKind}
                onValueChange={(value) => setCreateKind(value as "post" | "story")}
                className="absolute top-16"
              >
                <TabsList>
                  <TabsTrigger value="post" className="px-4">
                    {t("postTab")}
                  </TabsTrigger>
                  <TabsTrigger value="story" className="px-4">
                    {t("storyTab")}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <GalleryAdd
                className="size-16 text-muted-foreground"
                aria-hidden
              />
              <DialogDescription className="text-base text-foreground">
                {createKind === "story"
                  ? t("dragStory")
                  : t("dragPost")}
              </DialogDescription>
              <Button
                render={<label />}
                nativeButton={false}
                className="cursor-pointer"
              >
                {t("selectFromComputer")}
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple={createKind === "post"}
                  className="sr-only"
                  onChange={(event) =>
                    setCreateFiles([...(event.target.files ?? [])])
                  }
                />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <NotificationsSheet
        open={notificationsOpen}
        onOpenChange={setNotificationsOpen}
      />
    </>
  );
}
