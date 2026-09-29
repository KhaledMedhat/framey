import { asViewer, sendTyping } from "@/server/chat";
import { rateLimit } from "@/server/ratelimit";

export const POST = (_: Request, ctx: RouteContext<"/api/conversations/[id]/typing">) =>
  asViewer(async (viewerId) => {
    // Best effort: over the limit, the indicator just doesn't refresh.
    if (await rateLimit("typing", viewerId)) return new Response(null, { status: 204 });
    await sendTyping(viewerId, (await ctx.params).id);
    return Response.json({ ok: true });
  });
