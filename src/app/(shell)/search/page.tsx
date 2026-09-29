import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Comment, Heart } from "reicon-react";

import UserSearch from "@/components/shell/user-search";
import { auth } from "@/server/auth";
import { getRandomReels } from "@/server/feed";
import { getLang, getT } from "@/server/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("search") };
}

// ponytail: one random page of reels, no infinite scroll; page it through
// /api/reels?exclude= once people scroll past it.
const EXPLORE_REELS = 63;

/** Search people up top; a random wall of reels to explore below. */
export default async function SearchPage() {
  // The proxy guarantees a signed-in user here.
  const me = (await auth())!.user;
  const lang = await getLang();
  const [t, reels] = await Promise.all([
    getT(),
    getRandomReels(me.id, [], EXPLORE_REELS),
  ]);

  return (
    <div className="mx-auto w-full max-w-screen-2xl px-0 pt-6 pb-10 md:px-8 md:pt-10">
      <h1 className="sr-only">{t("search")}</h1>
      <div className="px-4 md:px-0">
        <UserSearch />
      </div>
      <h2 className="sr-only">{t("reels")}</h2>
      {reels.length ? (
        <ul className="mt-6 grid grid-cols-3 gap-0.5 md:mt-8 md:grid-cols-5 md:gap-1 lg:grid-cols-6 xl:grid-cols-7">
          {reels.map((reel, i) => {
            const cover = reel.media[0]?.cover?.url;
            return (
              <li key={reel.id}>
                <Link
                  href={`/reels/${reel.id}`}
                  aria-label={t("reelBy", { name: reel.author.username })}
                  className="group relative block aspect-9/16 overflow-hidden bg-muted focus-visible:outline-none"
                >
                  {cover && (
                    <Image
                      src={cover}
                      alt={reel.media[0]?.alt ?? ""}
                      fill
                      sizes="(min-width: 1280px) 15vw, (min-width: 1024px) 17vw, (min-width: 768px) 20vw, 33vw"
                      priority={i < 7}
                      className="object-cover"
                    />
                  )}
                  <span className="absolute inset-0 flex items-center justify-center gap-4 bg-background/55 text-sm font-semibold text-foreground opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none">
                    {(!reel.hidePostInfo || reel.author.id === me.id) && (
                      <span className="flex items-center gap-1.5 tabular-nums">
                        <Heart aria-hidden weight="Filled" className="size-5" />
                        {reel.likeCount.toLocaleString(lang)}
                      </span>
                    )}
                    {!reel.hideComments && (
                      <span className="flex items-center gap-1.5 tabular-nums">
                        <Comment aria-hidden weight="Filled" className="size-5" />
                        {reel.commentCount.toLocaleString(lang)}
                      </span>
                    )}
                  </span>
                  <span className="pointer-events-none absolute inset-0 ring-foreground ring-inset group-focus-visible:ring-2" />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-16 text-center text-sm text-muted-foreground">
          {t("noReelsToExplore")}
        </p>
      )}
    </div>
  );
}
