import { auth } from "@/server/auth";
import { authorizeChannel, userChannel } from "@/server/notifications";

/** pusher-js posts here before subscribing; only your own channel is allowed. */
export async function POST(request: Request) {
  const session = await auth();
  const form = await request.formData().catch(() => null);
  const socketId = form?.get("socket_id");
  const channel = form?.get("channel_name");
  if (
    !session?.user?.id ||
    typeof socketId !== "string" ||
    channel !== userChannel(session.user.id)
  ) {
    return Response.json({ message: "Forbidden." }, { status: 403 });
  }
  const signed = authorizeChannel(socketId, channel);
  return signed
    ? Response.json(signed)
    : Response.json({ message: "Pusher isn't configured." }, { status: 503 });
}
