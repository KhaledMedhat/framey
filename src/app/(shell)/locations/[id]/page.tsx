import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Copy, VideoPlay } from "reicon-react";

import { isVideoType } from "@/lib/files";
import { auth } from "@/server/auth";
import { getLocationPage, LOCATION_POST_LIMIT } from "@/server/feed";
import { getLang, getT } from "@/server/i18n";

// Shared by the page and its metadata: one query per request.
const getPlace = cache(async (id: string) => {
  const session = await auth();
  // The proxy guarantees a signed-in user here.
  return /^[NWR]\d{1,20}$/.test(id)
    ? getLocationPage(session!.user.id, id)
    : null;
});

export async function generateMetadata({
  params,
}: PageProps<"/locations/[id]">): Promise<Metadata> {
  const place = await getPlace((await params).id);
  return { title: place?.name || (await getT())("pageNotFound") };
}

/**
 * Photon relations ("R…") are areas (cities, regions), so they open zoomed
 * out; streets and venues open close.
 * ponytail: guessed from the id; store Photon's `extent` to fit areas exactly.
 */
const zoomFor = (id: string) => (id.startsWith("R") ? 11 : 15);

export default async function LocationPage({
  params,
}: PageProps<"/locations/[id]">) {
  const { id } = await params;
  const place = await getPlace(id);
  if (!place) notFound();
  const zoom = zoomFor(id);
  const [t, lang] = await Promise.all([getT(), getLang()]);

  const { name, lat, lng, posts } = place;
  const hasPin = lat !== null && lng !== null;
  const count =
    posts.length >= LOCATION_POST_LIMIT
      ? `${LOCATION_POST_LIMIT.toLocaleString(lang)}+ ${t("posts")}`
      : `${posts.length.toLocaleString(lang)} ${t(posts.length === 1 ? "post" : "posts")}`;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 md:px-6 md:py-10">
      <header className="flex flex-col gap-1 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-balance">
          {name}
        </h1>
        <p className="text-sm text-muted-foreground tabular-nums">{count}</p>
      </header>

      {hasPin && (
        <figure className="flex flex-col gap-2">
          {/* Dark mode inverts the tiles so the map sits in the room's grays. */}
          <iframe
            title={t("mapOf", { name })}
            // Google's keyless embed: OpenStreetMap's has no label language option.
            src={`https://maps.google.com/maps?q=${lat},${lng}&z=${zoom}&hl=${lang}&output=embed`}
            loading="lazy"
            className="aspect-[16/9] w-full bg-muted md:aspect-[16/7] dark:hue-rotate-180 dark:invert"
          />
          <figcaption className="text-end text-xs text-muted-foreground">
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-sm underline-offset-4 transition-colors duration-150 hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none"
            >
              {t("openInGoogleMaps")}
            </a>
          </figcaption>
        </figure>
      )}

      <h2 className="sr-only">{t("postsLabel")}</h2>
      <ul className="mt-6 grid grid-cols-3 gap-0.5 md:gap-1">
        {posts.map(({ id, media, multiple }) => {
          const video = isVideoType(media.type);
          const src = video ? media.cover?.url : media.url;
          return (
            <li key={id} className="relative aspect-square bg-muted">
              {src && (
                <Image
                  src={src}
                  alt={media.alt ?? ""}
                  fill
                  sizes="(min-width: 896px) 296px, 33vw"
                  className="object-cover"
                />
              )}
              {(multiple || video) && (
                <span className="pointer-events-none absolute end-2 top-2 text-white drop-shadow-sm">
                  {multiple ? (
                    <Copy aria-label={t("carousel")} className="size-5" />
                  ) : (
                    <VideoPlay
                      aria-label={t("video")}
                      weight="Filled"
                      className="size-5"
                    />
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
