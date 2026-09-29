import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft2 } from "reicon-react";

import { CloseFriendsList } from "@/components/shell/close-friends";
import { getT } from "@/server/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("closeFriends") };
}

export default async function CloseFriendsPage() {
  const t = await getT();
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <header className="flex items-center gap-2">
        <Link
          href="/settings"
          aria-label={t("back")}
          className="flex size-9 items-center justify-center rounded-md hover:bg-muted/50 md:hidden"
        >
          <ArrowLeft2 aria-hidden className="size-6 rtl:rotate-180" />
        </Link>
        <h1 className="text-xl font-bold">{t("closeFriends")}</h1>
      </header>
      <p className="text-sm text-muted-foreground">{t("closeFriendsNote")}</p>
      <CloseFriendsList />
    </div>
  );
}
