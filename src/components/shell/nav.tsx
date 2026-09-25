"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  AddSquare,
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
  User,
  VideoPlay,
  type IconComponent,
} from "reicon-react";

import type { ProfilePicture } from "@/interfaces/user.interface";
import { cn, FEED_PATH } from "@/lib/utils";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import FrameyMark from "./framey-mark";
import { SwitchAccountDialog } from "./switch-account";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { useTheme } from "next-themes";

type Item = { href: string; label: string; icon: IconComponent };
/** `fill`: the icon switches to its Filled weight when active; the rest thicken instead. */
type RailItem = Item & { fill?: IconWeight };

// Reels, messages, search and notifications are placeholders until those pages exist.
const RAIL: RailItem[] = [
  { href: FEED_PATH, label: "Home", icon: Home6, fill: "Filled" },
  { href: "/reels", label: "Reels", icon: VideoPlay, fill: "Filled" },
  { href: "/direct", label: "Messages", icon: Send, fill: "Filled" },
  { href: "/search", label: "Search", icon: Search },
  {
    href: "/notifications",
    label: "Notifications",
    icon: Heart,
    fill: "Filled",
  },
];

// ponytail: toggles for this visit only; persisting it needs a pre-paint script in layout.
// function toggleAppearance() {
//   document.documentElement.classList.toggle("dark");
// }

/**
 * Desktop: an icon rail with tooltip labels, Create (dialog), Profile (avatar)
 * and a More menu. Mobile: a tab bar of the routes that exist.
 */
export default function Nav({
  username,
  user,
  logout,
}: {
  username: string;
  user?: {
    firstName: string;
    lastName: string;
    profilePicture: ProfilePicture | null;
  };
  logout: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [createOpen, setCreateOpen] = useState(false);
  const { setTheme, theme } = useTheme();
  const items: Item[] = [
    { href: FEED_PATH, label: "Feed", icon: Home6 },
    { href: `/${username}`, label: "Profile", icon: User },
  ];
  // Page paths arrive encoded, so compare both forms of `/@me`.
  const isActive = (href: string) =>
    pathname === href || decodeURIComponent(pathname) === href;

  const itemClass = (active: boolean) =>
    cn(
      "flex size-11 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-muted/50 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none",
      active && "text-foreground",
    );

  const links = items.map(({ href, label, icon: Icon }) => {
    const active = isActive(href);
    return {
      href,
      label,
      active,
      glyph: (
        <Icon aria-hidden weight={active ? "Filled" : "Outline"} size={24} />
      ),
    };
  });

  const rail = RAIL.map((item) => ({ ...item, active: isActive(item.href) }));
  const profileActive = isActive(`/${username}`);

  return (
    <>
      {/* Desktop View */}
      <nav
        aria-label="Main"
        className="fixed inset-y-0 left-0 z-40 hidden w-18 flex-col items-center justify-between bg-background py-5 md:flex"
      >
        <Link
          href={FEED_PATH}
          aria-label="Framey home"
          className="flex size-11 items-center justify-center rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <FrameyMark className="size-8 text-foreground" />
        </Link>

        <ul className="flex flex-col gap-2">
          {rail.map((item) => (
            <li key={item.href}>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Link
                      href={item.href}
                      aria-label={item.label}
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
                  }
                />
                <TooltipContent side="right">{item.label}</TooltipContent>
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
                    aria-label="Create"
                    onClick={() => setCreateOpen(true)}
                    className={itemClass(false)}
                  >
                    <AddSquare aria-hidden className="shrink-0" size={24} />
                  </Button>
                }
              />
              <TooltipContent side="right">Create</TooltipContent>
            </Tooltip>
          </li>
          <li>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Link
                    href={`/${username}`}
                    aria-label="Profile"
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
              <TooltipContent side="right">Profile</TooltipContent>
            </Tooltip>
          </li>
        </ul>

        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger
              render={
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      aria-label="More"
                      className={itemClass(false)}
                    />
                  }
                />
              }
            >
              <Menu aria-hidden className="size-6 shrink-0" />
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              More
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent
            side="right"
            align="end"
            sideOffset={12}
            className="w-60 p-1.5"
          >
            {[
              { href: "/settings", label: "Settings", icon: Setting2 },
              {
                href: "/your-activity",
                label: "Your activity",
                icon: Activity,
              },
              { href: "/saved", label: "Saved", icon: Bookmark2 },
            ].map(({ href, label: text, icon: Icon }) => (
              <DropdownMenuItem
                key={href}
                render={<Link href={href} />}
                className="h-10 gap-3 px-3"
              >
                <Icon aria-hidden size={20} />
                {text}
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
              Switch appearance
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              render={
                <SwitchAccountDialog
                  className="w-full justify-start"
                  switchAccountButtonIcon={Profile2user}
                  switchAccountButtonVariant="ghost"
                  switchAccountButtonLabel="Switch accounts"
                />
              }
              className="h-10 gap-3 px-3"
            ></DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => void logout()}
              className="h-10 gap-3 px-3"
            >
              <Logout aria-hidden size={20} />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>

      {/* Mobile View*/}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 flex h-14 items-center justify-around border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {links.map(({ href, label, active, glyph }) => (
          <Link
            key={href}
            href={href}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className={itemClass(active)}
          >
            {glyph}
          </Link>
        ))}
        <form action={logout}>
          <Button
            type="submit"
            aria-label="Log out"
            className={itemClass(false)}
          >
            <Logout aria-hidden />
          </Button>
        </form>
      </nav>

      {/* ponytail: placeholder until the composer wires in the image/video editors. */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-xl">
          <DialogHeader className="border-b px-4 py-3">
            <DialogTitle className="text-center">Create new post</DialogTitle>
          </DialogHeader>
          <div className="flex aspect-square flex-col items-center justify-center gap-5 px-6 text-center">
            <GalleryAdd className="size-16 text-muted-foreground" aria-hidden />
            <DialogDescription className="text-base text-foreground">
              Drag photos and videos here
            </DialogDescription>
            <Button
              render={<label />}
              nativeButton={false}
              className="cursor-pointer"
            >
              Select from computer
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                className="sr-only"
              />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
