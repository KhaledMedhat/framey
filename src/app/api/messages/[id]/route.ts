import { asViewer, unsendMessage } from "@/server/chat";
import { utapi } from "@/server/uploadthing";

/** Unsend one of your messages, for everyone. */
export const DELETE = (_: Request, ctx: RouteContext<"/api/messages/[id]">) =>
  asViewer(async (viewerId) => {
    const key = await unsendMessage(viewerId, (await ctx.params).id);
    if (key) await utapi.deleteFiles(key).catch(() => {});
    return Response.json({ ok: true });
  });
