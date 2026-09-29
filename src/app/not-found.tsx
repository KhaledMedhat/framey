import Link from "next/link";

import { Button } from "@/components/ui/button";
import { FEED_PATH } from "@/lib/utils";
import { getT } from "@/server/i18n";

export default async function NotFound() {
  const t = await getT();
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-2xl font-bold tracking-tight">{t("pageNotFoundTitle")}</h1>
      <p className="max-w-sm text-sm text-pretty text-muted-foreground">
        {t("pageNotFoundBody")}
      </p>
      <Button nativeButton={false} render={<Link href={FEED_PATH} />} className="mt-2">
        {t("backToFramey")}
      </Button>
    </main>
  );
}
