import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import { eq } from "drizzle-orm";

import { getFullName } from "@/lib/utils";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";

// Shared by the page and its metadata: one query per request.
const getProfile = cache((username: string) =>
  db.query.users.findFirst({
    where: eq(users.username, username),
    columns: { username: true, firstName: true, lastName: true },
  }),
);

export async function profileMetadata(username: string): Promise<Metadata> {
  const user = await getProfile(username.toLowerCase());
  return {
    title: user
      ? `${getFullName(user.firstName, user.lastName)} (@${user.username})`
      : "Page not found",
  };
}

export default async function Profile({ username }: { username: string }) {
  // Usernames are stored lowercase: one canonical URL per profile.
  const canonical = username.toLowerCase();
  if (canonical !== username) permanentRedirect(`/${canonical}`);

  const user = await getProfile(canonical);
  if (!user) notFound();

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-bold">@{user.username}</h1>
    </div>
  );
}
