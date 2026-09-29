import z from "zod";

import { MESSAGE_MAX } from "@/lib/validations";
import { asViewer, ChatError, openDirect, sendMessage } from "@/server/chat";
import { rateLimit, tooManyRequests } from "@/server/ratelimit";
import { canSeeStory } from "@/server/stories";

const replySchema = z.object({ text: z.string().trim().min(1).max(MESSAGE_MAX) });

/** A comment on a story lands in the author's messages, pointing at it. */
export const POST = (request: Request, ctx: RouteContext<"/api/stories/[id]/reply">) =>
  asViewer(async (viewerId) => {
    const retryAfter = await rateLimit("message", viewerId);
    if (retryAfter) return tooManyRequests(retryAfter);
    const id = z.uuid().safeParse((await ctx.params).id);
    const story = id.success ? await canSeeStory(viewerId, id.data) : null;
    if (!story) throw new ChatError("Story not found.", 404);
    if (story.authorId === viewerId) {
      throw new ChatError("You can't reply to your own story.", 400);
    }
    const parsed = replySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ChatError("Write something first.", 400);
    const conversationId = await openDirect(viewerId, story.authorId);
    await sendMessage(viewerId, conversationId, {
      text: parsed.data.text,
      storyId: id.data!,
    });
    return Response.json({ conversationId }, { status: 201 });
  });
