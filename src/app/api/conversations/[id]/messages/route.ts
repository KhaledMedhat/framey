import { isAudioFile, isImageFile, isVideoFile } from "@/lib/files";
import { gifSchema, MESSAGE_MAX } from "@/lib/validations";
import { asViewer, getMessages, sendMessage } from "@/server/chat";
import { rateLimit, tooManyRequests } from "@/server/ratelimit";
import { encodePhoto, utapi } from "@/server/uploadthing";

type Ctx = RouteContext<"/api/conversations/[id]/messages">;

const MB = 1024 * 1024;
const MAX_IMAGE = 20 * MB;
const MAX_VIDEO = 100 * MB;
const MAX_VOICE = 10 * MB;

const badRequest = (message: string) =>
  Response.json({ message }, { status: 400 });

/** `?before=<iso>`: the page of older messages, newest first. */
export const GET = (request: Request, ctx: Ctx) =>
  asViewer(async (viewerId) => {
    const before = new URL(request.url).searchParams.get("before") ?? undefined;
    if (before && Number.isNaN(Date.parse(before))) return badRequest("Invalid cursor.");
    return Response.json(await getMessages(viewerId, (await ctx.params).id, before));
  });

/** Multipart: `text`, and/or one photo, video or voice recording as `file`, or a GIPHY `gif` (JSON). */
export const POST = (request: Request, ctx: Ctx) =>
  asViewer(async (viewerId) => {
    const retryAfter = await rateLimit("message", viewerId);
    if (retryAfter) return tooManyRequests(retryAfter);

    const form = await request.formData().catch(() => null);
    const text = String(form?.get("text") ?? "").trim();
    const file = form?.get("file");
    // A GIPHY GIF: stored as its URL, nothing uploaded.
    let gif = null;
    if (form?.has("gif")) {
      let raw: unknown = null;
      try {
        raw = JSON.parse(String(form.get("gif")));
      } catch {}
      const parsed = gifSchema.safeParse(raw);
      if (!parsed.success) return badRequest("Pick a GIF from the list.");
      gif = parsed.data;
    }
    if (text.length > MESSAGE_MAX) return badRequest("That message is too long.");
    if (!text && !gif && !(file instanceof File)) return badRequest("Write something first.");

    let media;
    if (file instanceof File) {
      const image = isImageFile(file);
      const voice = isAudioFile(file);
      if (!image && !voice && !isVideoFile(file)) {
        return badRequest("Only photos, videos and voice messages can be sent.");
      }
      if (file.size === 0 || file.size > (image ? MAX_IMAGE : voice ? MAX_VOICE : MAX_VIDEO)) {
        return badRequest(
          voice
            ? `A voice message must be under ${MAX_VOICE / MB} MB.`
            : `A photo must be under ${MAX_IMAGE / MB} MB and a video under ${MAX_VIDEO / MB} MB.`,
        );
      }
      let encoded: Awaited<ReturnType<typeof encodePhoto>> | null = null;
      try {
        if (image) encoded = await encodePhoto(file);
      } catch {
        return badRequest("Your photo couldn't be read.");
      }
      const upload = await utapi.uploadFiles(encoded?.file ?? file);
      if (upload.error) {
        return Response.json(
          { message: "Could not send your file. Please try again." },
          { status: 502 },
        );
      }
      media = {
        url: upload.data.ufsUrl,
        key: upload.data.key,
        type: image ? "image/webp" : file.type,
        size: upload.data.size,
        width: encoded?.width,
        height: encoded?.height,
      };
    }

    const { id } = await ctx.params;
    // Replying: the first message sent quotes it (sendMessage checks it's this chat's).
    const reply = String(form?.get("replyToId") ?? "");
    let replyToId = /^[0-9a-f-]{36}$/i.test(reply) ? reply : undefined;
    const quote = () => {
      const quoted = replyToId;
      replyToId = undefined;
      return quoted;
    };
    try {
      // The photo and the caption go as two messages, like Instagram.
      if (gif) await sendMessage(viewerId, id, { media: { ...gif, type: "image/gif" }, replyToId: quote() });
      if (media) await sendMessage(viewerId, id, { media, replyToId: quote() });
      if (text) await sendMessage(viewerId, id, { text, replyToId: quote() });
    } catch (error) {
      if (media) await utapi.deleteFiles(media.key).catch(() => {});
      throw error;
    }
    return Response.json({ ok: true }, { status: 201 });
  });
