import Link from "next/link";

import { getFullName } from "@/lib/utils";
import type { Translate } from "@/lib/i18n";
import { auth } from "@/server/auth";
import { getFeedPage, getSuggestedAccounts } from "@/server/feed";
import { getT } from "@/server/i18n";
import { getStoryTray } from "@/server/stories";
import { ChatLauncher } from "./chat";
import FeedStream from "./feed-stream";
import { StoryTray } from "./stories";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { SwitchAccountDialog } from "./switch-account";

type Account = Awaited<ReturnType<typeof getSuggestedAccounts>>[number];

export default async function Feed() {
  const session = await auth();
  // The proxy guarantees a signed-in user here.
  const viewer = session!.user;
  const [t, page, suggestions, reels] = await Promise.all([
    getT(),
    getFeedPage(viewer.id),
    getSuggestedAccounts(viewer.id),
    getStoryTray(viewer.id),
  ]);

  return (
    <div className="flex">
      <h1 className="sr-only">{t("feed")}</h1>
      <div className="flex h-[calc(100svh-3.5rem-env(safe-area-inset-bottom))] min-w-0 flex-1 flex-col md:h-svh">
        <StoryTray
          reels={reels}
          me={{
            id: viewer.id,
            username: viewer.username,
            profilePicture: viewer.profilePicture,
          }}
        />
        {page.posts.length ? (
          // Remount when a new post lands on top (e.g. after sharing one).
          <FeedStream key={page.posts[0]?.id} initial={page} />
        ) : (
          <EmptyFeed suggestions={suggestions} t={t} />
        )}
      </div>

      {/* From 1440px only: below that the full-height post outranks the rail. */}
      <aside
        aria-label={t("youAndSuggestions")}
        className="sticky top-0 hidden h-svh w-80 shrink-0 flex-col gap-10 border-s px-6 py-8 min-[90rem]:flex"
      >
        <div className="flex items-center gap-3">
          <Link
            href={`/${viewer.username}`}
            className="-m-2 flex min-w-0 flex-1 items-center gap-3 rounded-lg p-2 transition-colors duration-150 hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none"
          >
            <Avatar size="lg">
              <AvatarImage
                src={viewer.profilePicture?.url}
                alt={viewer.username}
              />
              <AvatarFallback className="bg-muted text-muted-foreground">
                {viewer.username.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="min-w-0 text-sm">
              <span className="block truncate font-semibold">
                {viewer.username}
              </span>
              <span className="block truncate text-muted-foreground">
                {getFullName(viewer.firstName, viewer.lastName)}
              </span>
            </span>
          </Link>
          <SwitchAccountDialog
            className="text-xs"
            switchAccountButtonVariant="link"
            switchAccountButtonLabel={t("switch")}
          />
        </div>

        {suggestions.length > 0 && (
          <section
            aria-labelledby="suggested-heading"
            className="flex flex-col gap-4"
          >
            <h2
              id="suggested-heading"
              className="text-sm font-medium text-muted-foreground"
            >
              {t("suggestedForYou")}
            </h2>
            <AccountList accounts={suggestions} />
          </section>
        )}

        <div className="mt-auto">
          <ChatLauncher variant="pill" />
        </div>
      </aside>
      <ChatLauncher variant="fab" />
    </div>
  );
}

function AccountList({ accounts }: { accounts: Account[] }) {
  return (
    <ul className="flex flex-col gap-1">
      {accounts.map((account) => (
        <li key={account.id}>
          <Link
            href={`/${account.username}`}
            className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors duration-150 hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none"
          >
            <Avatar>
              <AvatarImage
                src={account.profilePicture?.url}
                alt={account.username}
              />
              <AvatarFallback className="bg-muted text-muted-foreground">
                {account.username.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="min-w-0 text-sm">
              <span className="block truncate font-medium">
                {account.username}
              </span>
              <span className="block truncate text-muted-foreground">
                {getFullName(account.firstName, account.lastName)}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function EmptyFeed({
  suggestions,
  t,
}: {
  suggestions: Account[];
  t: Translate;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-8 px-6">
      <div className="flex max-w-sm flex-col gap-3 text-center">
        <h2 className="text-2xl font-bold tracking-tight text-balance">
          {t("emptyFeedTitle")}
        </h2>
        <p className="text-sm text-muted-foreground text-pretty">
          {t("emptyFeedBody")}
        </p>
      </div>
      {suggestions.length > 0 && (
        <section
          aria-labelledby="empty-suggested"
          className="flex w-full max-w-xs flex-col gap-3 min-[90rem]:hidden"
        >
          <h3
            id="empty-suggested"
            className="text-sm font-medium text-muted-foreground"
          >
            {t("peopleOnFramey")}
          </h3>
          <AccountList accounts={suggestions} />
        </section>
      )}
    </div>
  );
}
