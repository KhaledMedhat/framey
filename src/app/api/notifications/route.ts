import { auth } from "@/server/auth";
import { getNotifications, markAllRead } from "@/server/notifications";

const unauthorized = () =>
  Response.json({ message: "Sign in to see notifications." }, { status: 401 });

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();
  return Response.json(await getNotifications(session.user.id));
}

/** "Mark all as read". */
export async function PATCH() {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();
  await markAllRead(session.user.id);
  return Response.json({ ok: true });
}
