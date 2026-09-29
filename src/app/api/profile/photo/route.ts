import { eq } from "drizzle-orm";

import { isImageFile } from "@/lib/files";
import { recordAccountChanges } from "@/server/activity";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { rateLimit, tooManyRequests } from "@/server/ratelimit";
import { uploadProfilePicture, utapi } from "@/server/uploadthing";

const MAX_BYTES = 10 * 1024 * 1024;

/** Multipart `file`: replaces your profile picture. */
export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ message: "Sign in first." }, { status: 401 });
  }
  const retryAfter = await rateLimit("profilePhoto", userId);
  if (retryAfter) return tooManyRequests(retryAfter);
  const file = (await request.formData().catch(() => null))?.get("file");
  if (!(file instanceof File) || !isImageFile(file) || file.size === 0) {
    return Response.json({ message: "Choose a photo." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ message: "A photo must be under 10 MB." }, { status: 400 });
  }

  const uploaded = await uploadProfilePicture(file).catch(() => null);
  if (!uploaded) {
    return Response.json(
      { message: "Couldn't upload your photo. Try again." },
      { status: 502 },
    );
  }
  const [before] = await db
    .select({ picture: users.profilePicture })
    .from(users)
    .where(eq(users.id, userId));
  await db
    .update(users)
    .set({ profilePicture: uploaded })
    .where(eq(users.id, userId));
  if (before?.picture?.key) await utapi.deleteFiles(before.picture.key).catch(() => {});
  await recordAccountChanges(userId, [
    { kind: "photo", before: before?.picture?.url ?? null, after: uploaded.url },
  ]);
  return Response.json(uploaded);
}
