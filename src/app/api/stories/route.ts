import { eq } from "drizzle-orm";

import { isImageFile, isVideoFile } from "@/lib/files";
import { storyInputSchema } from "@/lib/validations";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { closeFriends, stories } from "@/server/db/schema";
import { rateLimit, tooManyRequests } from "@/server/ratelimit";
import { encodePhoto, utapi } from "@/server/uploadthing";

const MB = 1024 * 1024;
const MAX_IMAGE = 20 * MB;
const MAX_VIDEO = 100 * MB;

const badRequest = (message: string) =>
  Response.json({ message }, { status: 400 });

/**
 * Multipart: `story` is the JSON described by `storyInputSchema`, `file` the
 * edited photo or video, and `cover` a video's poster frame.
 */
export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ message: "Sign in to share stories." }, { status: 401 });
  }
  const retryAfter = await rateLimit("createStory", userId);
  if (retryAfter) return tooManyRequests(retryAfter);

  const formData = await request.formData().catch(() => null);
  let json: unknown = null;
  try {
    json = JSON.parse(String(formData?.get("story")));
  } catch {}
  const parsed = storyInputSchema.safeParse(json);
  const file = formData?.get("file");
  const cover = parsed.success && parsed.data.hasCover ? formData?.get("cover") : null;
  if (!parsed.success || !(file instanceof File)) return badRequest("Invalid story.");

  const image = isImageFile(file);
  if (!image && !isVideoFile(file)) {
    return badRequest("Only photos and videos can be shared.");
  }
  if (file.size === 0 || file.size > (image ? MAX_IMAGE : MAX_VIDEO)) {
    return badRequest(
      `A photo must be under ${MAX_IMAGE / MB} MB and a video under ${MAX_VIDEO / MB} MB.`,
    );
  }
  if (cover && !(cover instanceof File && isImageFile(cover))) {
    return badRequest("Invalid story.");
  }
  if (
    parsed.data.closeFriends &&
    !(await db.$count(closeFriends, eq(closeFriends.userId, userId)))
  ) {
    return badRequest("Add someone to close friends first.");
  }

  let encoded: Awaited<ReturnType<typeof encodePhoto>> | null;
  try {
    encoded = image ? await encodePhoto(file) : cover ? await encodePhoto(cover as File) : null;
  } catch {
    return badRequest("Your photo couldn't be read.");
  }
  const uploads = await utapi.uploadFiles(
    image ? [encoded!.file] : encoded ? [file, encoded.file] : [file],
  );
  const keys = uploads.flatMap((u) => (u.data ? [u.data.key] : []));
  if (uploads.some((u) => u.error)) {
    if (keys.length) await utapi.deleteFiles(keys).catch(() => {});
    return Response.json(
      { message: "Could not upload your story. Please try again." },
      { status: 502 },
    );
  }

  const [main, poster] = uploads.map((u) => u.data!);
  const [story] = await db
    .insert(stories)
    .values({
      authorId: userId,
      url: main!.ufsUrl,
      key: main!.key,
      type: image ? "image/webp" : file.type,
      width: encoded?.width,
      height: encoded?.height,
      cover: poster && {
        url: poster.ufsUrl,
        key: poster.key,
        type: "image/webp",
        size: poster.size,
        width: encoded?.width,
        height: encoded?.height,
      },
      muted: image ? false : (parsed.data.muted ?? false),
      duration: image ? null : parsed.data.duration,
      closeFriends: parsed.data.closeFriends ?? false,
      overlays: parsed.data.overlays,
    })
    .returning({ id: stories.id });
  return Response.json({ id: story!.id }, { status: 201 });
}
