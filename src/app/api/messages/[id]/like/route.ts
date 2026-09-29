import { asViewer, setMessageLike } from "@/server/chat";

type Ctx = RouteContext<"/api/messages/[id]/like">;

const toggle = (liked: boolean) => (_: Request, ctx: Ctx) =>
  asViewer(async (viewerId) => {
    await setMessageLike(viewerId, (await ctx.params).id, liked);
    return Response.json({ ok: true });
  });

export const POST = toggle(true);
export const DELETE = toggle(false);
