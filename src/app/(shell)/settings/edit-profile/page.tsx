import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { ArrowLeft2 } from "reicon-react";

import { EditProfileForm } from "@/components/shell/settings";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { getT } from "@/server/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("editProfile") };
}

export default async function EditProfilePage() {
  const t = await getT();
  // The proxy guarantees a signed-in user here.
  const userId = (await auth())!.user.id;
  const user = (await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      username: true,
      firstName: true,
      lastName: true,
      websites: true,
      bio: true,
      gender: true,
      profilePicture: true,
    },
  }))!;

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
        <h1 className="text-xl font-bold">{t("editProfile")}</h1>
      </header>
      <EditProfileForm user={user} />
    </div>
  );
}
