import { asViewer, sendTyping } from "@/server/chat";

export const POST = (_: Request, ctx: RouteContext<"/api/conversations/[id]/typing">) =>
  asViewer(async (viewerId) => {
    await sendTyping(viewerId, (await ctx.params).id);
    return Response.json({ ok: true });
  });
