import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/server/auth";
import { getRandomReels } from "@/server/feed";
import { getT } from "@/server/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("reels") };
}

/** Opens a random reel; scrolling from there brings more. */
export default async function ReelsPage() {
  const me = (await auth())!.user;
  const [reel] = await getRandomReels(me.id, [], 1);
  if (reel) redirect(`/reels/${reel.id}`);
  return (
    <p className="mt-24 text-center text-sm text-muted-foreground">
      {(await getT())("noReelsToWatch")}
    </p>
  );
}
