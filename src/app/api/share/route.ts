import { sharePostSchema } from "@/lib/validations";
import { asViewer, sharePost } from "@/server/chat";
import { rateLimit, tooManyRequests } from "@/server/ratelimit";

/** Sends a post or reel (and an optional note) to people and chats. */
export const POST = (request: Request) =>
  asViewer(async (viewerId) => {
    const retryAfter = await rateLimit("message", viewerId);
    if (retryAfter) return tooManyRequests(retryAfter);
    const parsed = sharePostSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ message: "Invalid share." }, { status: 400 });
    }
    const { postId, ...targets } = parsed.data;
    return Response.json({ conversationIds: await sharePost(viewerId, postId, targets) });
  });
