import type { Metadata } from "next";

import { getT } from "@/server/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("settings") };
}

/** A phone shows only the sidebar here; a desktop points at it. */
export default async function SettingsPage() {
  const t = await getT();
  return (
    <p className="hidden pt-20 text-center text-sm text-muted-foreground md:block">
      {t("settings")}
    </p>
  );
}
