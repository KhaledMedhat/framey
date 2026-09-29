import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft2 } from "reicon-react";

import { PrivacyToggle } from "@/components/shell/settings";
import { auth } from "@/server/auth";
import { getT } from "@/server/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("accountPrivacy") };
}

export default async function PrivacyPage() {
  const t = await getT();
  const { visibility } = (await auth())!.user;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-8">
      <header className="flex items-center gap-2">
        <Link
          href="/settings"
          aria-label={t("back")}
          className="flex size-9 items-center justify-center rounded-md hover:bg-muted/50 md:hidden"
        >
          <ArrowLeft2 aria-hidden className="size-6 rtl:rotate-180" />
        </Link>
        <h1 className="text-xl font-bold">{t("accountPrivacy")}</h1>
      </header>
      <PrivacyToggle visibility={visibility} />
    </div>
  );
}
