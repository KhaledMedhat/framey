import { inArray } from "drizzle-orm";

import { sharePostInputSchema } from "@/lib/validations";
import { isImageFile, isVideoFile } from "@/lib/files";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { postMedia, posts, users } from "@/server/db/schema";
import { rateLimit, tooManyRequests } from "@/server/ratelimit";
import { encodePhoto, utapi } from "@/server/uploadthing";
import { notifyMentions } from "@/server/notifications";

const MB = 1024 * 1024;
const MAX_IMAGE = 20 * MB;
const MAX_VIDEO = 100 * MB;

const badRequest = (message: string) =>
  Response.json({ message }, { status: 400 });

/**
 * Multipart: `post` is the JSON described by `sharePostInputSchema`, then one
 * `file` per media in order, and `cover:<index>` for each video that has one.
 * Media arrive already edited in the browser; this only stores them.
 */
export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json(
      { message: "Sign in to share posts." },
      { status: 401 },
    );
  }
  const retryAfter = await rateLimit("createPost", userId);
  if (retryAfter) return tooManyRequests(retryAfter);

  const formData = await request.formData().catch(() => null);
  let json: unknown = null;
  try {
    json = JSON.parse(String(formData?.get("post")));
  } catch {}
  const parsed = sharePostInputSchema.safeParse(json);
  if (!formData || !parsed.success) return badRequest("Invalid post.");
  const input = parsed.data;

  const files = formData.getAll("file");
  if (files.length !== input.media.length) return badRequest("Invalid post.");

  const items: { file: File; cover: File | null }[] = [];
  for (const [index, file] of files.entries()) {
    if (!(file instanceof File)) return badRequest("Invalid post.");
    const image = isImageFile(file);
    if (!image && !isVideoFile(file)) {
      return badRequest("Only photos and videos can be shared.");
    }
    if (file.size === 0 || file.size > (image ? MAX_IMAGE : MAX_VIDEO)) {
      return badRequest(
        `Each photo must be under ${MAX_IMAGE / MB} MB and each video under ${MAX_VIDEO / MB} MB.`,
      );
    }
    const cover = input.media[index]!.hasCover
      ? formData.get(`cover:${index}`)
      : null;
    if (cover !== null && !(cover instanceof File && isImageFile(cover))) {
      return badRequest("Invalid post.");
    }
    items.push({ file, cover });
  }

  // Photos and video covers are re-encoded; the video itself was already
  // trimmed and compressed by ffmpeg in the browser.
  let encoded: Awaited<ReturnType<typeof encodePhoto>>[];
  try {
    encoded = await Promise.all(
      items.map(({ file, cover }) =>
        encodePhoto(isImageFile(file) ? file : cover!),
      ),
    );
  } catch {
    return badRequest("One of your photos couldn't be read.");
  }
  const uploadList = items.flatMap(({ file, cover }, i) =>
    isImageFile(file)
      ? [encoded[i]!.file]
      : cover
        ? [file, encoded[i]!.file]
        : [file],
  );

  const uploads = await utapi.uploadFiles(uploadList);
  const uploadedKeys = uploads.flatMap((u) => (u.data ? [u.data.key] : []));
  if (uploads.some((u) => u.error)) {
    if (uploadedKeys.length)
      await utapi.deleteFiles(uploadedKeys).catch(() => {});
    return Response.json(
      { message: "Could not upload your media. Please try again." },
      { status: 502 },
    );
  }

  // Tags point at real accounts on real photos; usernames come from the DB.
  const tagged = input.tags?.length
    ? await db
        .select({ id: users.id, username: users.username })
        .from(users)
        .where(inArray(users.id, input.tags.map((t) => t.userId)))
    : [];
  const usernames = new Map(tagged.map((u) => [u.id, u.username]));
  const tags = (input.tags ?? []).flatMap((tag) => {
    const username = usernames.get(tag.userId);
    const item = items[tag.mediaIndex];
    return username && item && isImageFile(item.file) ? [{ ...tag, username }] : [];
  });

  const postId = crypto.randomUUID();
  let cursor = 0;
  const mediaRows = items.map(({ file, cover }, order) => {
    const video = isVideoFile(file);
    const upload = uploads[cursor++]!.data!;
    const coverUpload = video && cover ? uploads[cursor++]!.data! : null;
    const meta = input.media[order]!;
    // A video takes the size of its cover, captured from the cropped frame.
    const { width, height } = encoded[order]!;
    return {
      postId,
      order,
      url: upload.ufsUrl,
      key: upload.key,
      type: video ? file.type : "image/webp",
      size: upload.size,
      width,
      height,
      alt: meta.alt || null,
      cover: coverUpload && {
        url: coverUpload.ufsUrl,
        key: coverUpload.key,
        type: "image/webp",
        size: coverUpload.size,
        width,
        height,
      },
      muted: video ? (meta.muted ?? false) : false,
      duration: video ? meta.duration : undefined,
    };
  });

  try {
    // neon-http runs a batch as one transaction: no post without its media.
    await db.batch([
      db.insert(posts).values({
        id: postId,
        authorId: userId,
        caption: input.caption?.trim() || null,
        location: input.location || null,
        // Only a picked suggestion links to a place page; typed text doesn't.
        locationId: input.location ? (input.place?.id ?? null) : null,
        locationLat: input.location ? (input.place?.lat ?? null) : null,
        locationLng: input.location ? (input.place?.lng ?? null) : null,
        hideComments: input.hideComments,
        hidePostInfo: input.hidePostInfo,
        tags,
      }),
      db.insert(postMedia).values(mediaRows),
    ]);
  } catch (error) {
    await utapi.deleteFiles(uploadedKeys).catch(() => {});
    throw error;
  }

  if (input.caption) await notifyMentions(input.caption, userId, { postId });
  return Response.json({ id: postId }, { status: 201 });
}
