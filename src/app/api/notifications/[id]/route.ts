import { auth } from "@/server/auth";
import { markRead } from "@/server/notifications";

/** Opening a notification reads it (and only it). */
export async function PATCH(_: Request, ctx: RouteContext<"/api/notifications/[id]">) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ message: "Sign in to see notifications." }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return Response.json({ message: "Notification not found." }, { status: 404 });
  }
  await markRead(session.user.id, id);
  return Response.json({ ok: true });
}
