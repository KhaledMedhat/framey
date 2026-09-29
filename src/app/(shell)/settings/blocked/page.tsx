import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft2 } from "reicon-react";

import { BlockedList } from "@/components/shell/settings";
import { auth } from "@/server/auth";
import { getBlockedAccounts } from "@/server/blocks";
import { getT } from "@/server/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("blockedAccounts") };
}

export default async function BlockedPage() {
  const t = await getT();
  const accounts = await getBlockedAccounts((await auth())!.user.id);

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
        <h1 className="text-xl font-bold">{t("blockedAccounts")}</h1>
      </header>
      <p className="text-sm text-muted-foreground">{t("blockedNote")}</p>
      <BlockedList accounts={accounts} />
    </div>
  );
}
