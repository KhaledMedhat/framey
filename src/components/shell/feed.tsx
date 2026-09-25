import Link from "next/link";
import { ArrowLeft, ArrowRight } from "reicon-react";

import { getFullName } from "@/lib/utils";
import { auth } from "@/server/auth";
import { getFeedPage, getSuggestedAccounts } from "@/server/feed";
import FeedStream from "./feed-stream";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { SwitchAccountDialog } from "./switch-account";

type Account = Awaited<ReturnType<typeof getSuggestedAccounts>>[number];

export default async function Feed() {
  const session = await auth();
  // The proxy guarantees a signed-in user here.
  const viewer = session!.user;
  const [page, suggestions] = await Promise.all([
    getFeedPage(viewer.id),
    getSuggestedAccounts(viewer.id),
  ]);

  return (
    <div className="flex">
      <h1 className="sr-only">Feed</h1>
      <div className="min-w-0 flex-1">
        {page.posts.length ? (
          <FeedStream initial={page} />
        ) : (
          <EmptyFeed suggestions={suggestions} />
        )}
      </div>

      {/* From 1440px only: below that the full-height post outranks the rail. */}
      <aside
        aria-label="You and suggestions"
        className="sticky top-0 hidden h-svh w-80 shrink-0 flex-col gap-10 border-l px-6 py-8 min-[90rem]:flex"
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
            switchAccountButtonVariant="link"
            switchAccountButtonLabel="Switch"
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
              Suggested for you
            </h2>
            <AccountList accounts={suggestions} />
          </section>
        )}

        <section
          aria-labelledby="keys-heading"
          className="mt-auto flex flex-col gap-3 text-xs text-muted-foreground"
        >
          <h2 id="keys-heading" className="sr-only">
            Keyboard shortcuts
          </h2>
          <Shortcut
            keys={[
              ["J", "J"],
              ["K", "K"],
            ]}
            label="Next and previous post"
          />
          <Shortcut
            keys={[
              [
                "left",
                <ArrowLeft
                  key="l"
                  className="size-3"
                  aria-label="Left arrow"
                />,
              ],
              [
                "right",
                <ArrowRight
                  key="r"
                  className="size-3"
                  aria-label="Right arrow"
                />,
              ],
            ]}
            label="Photos in a post"
          />
          <p>Double-click a photo to like it.</p>
        </section>
      </aside>
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

function Shortcut({
  keys,
  label,
}: {
  keys: [id: string, glyph: React.ReactNode][];
  label: string;
}) {
  return (
    <p className="flex items-center gap-3">
      <span className="flex gap-1">
        {keys.map(([id, glyph]) => (
          <kbd
            key={id}
            className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border px-1.5 font-sans text-xs text-foreground"
          >
            {glyph}
          </kbd>
        ))}
      </span>
      {label}
    </p>
  );
}

function EmptyFeed({ suggestions }: { suggestions: Account[] }) {
  return (
    <div className="flex h-[calc(100svh-3.5rem-env(safe-area-inset-bottom))] flex-col items-center justify-center gap-8 px-6 md:h-svh">
      <div className="flex max-w-sm flex-col gap-3 text-center">
        <h2 className="text-2xl font-bold tracking-tight text-balance">
          Nothing in your feed yet
        </h2>
        <p className="text-sm text-muted-foreground text-pretty">
          Posts from you and the people you follow land here, one full frame at
          a time.
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
            People on Framey
          </h3>
          <AccountList accounts={suggestions} />
        </section>
      )}
    </div>
  );
}
