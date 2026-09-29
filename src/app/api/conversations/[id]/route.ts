import {
  acceptRequest,
  asViewer,
  getChat,
  markRead,
  removeChat,
} from "@/server/chat";

type Ctx = RouteContext<"/api/conversations/[id]">;

export const GET = (_: Request, ctx: Ctx) =>
  asViewer(async (viewerId) =>
    Response.json(await getChat(viewerId, (await ctx.params).id)),
  );

/** `{ action: "read" }` marks it seen; `{ action: "accept" }` accepts a request. */
export const PATCH = (request: Request, ctx: Ctx) =>
  asViewer(async (viewerId) => {
    const { id } = await ctx.params;
    const body = (await request.json().catch(() => null)) as { action?: string } | null;
    if (body?.action === "read") await markRead(viewerId, id);
    else if (body?.action === "accept") await acceptRequest(viewerId, id);
    else return Response.json({ message: "Unknown action." }, { status: 400 });
    return Response.json({ ok: true });
  });

/** Deletes a 1:1 chat (or request) for you; leaves a group. */
export const DELETE = (_: Request, ctx: Ctx) =>
  asViewer(async (viewerId) => {
    await removeChat(viewerId, (await ctx.params).id);
    return Response.json({ ok: true });
  });
