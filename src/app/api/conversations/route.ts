import { newChatSchema } from "@/lib/validations";
import { asViewer, createGroup, getChats, openDirect } from "@/server/chat";

/** `?folder=inbox|requests`: your chats there, latest activity first. */
export const GET = (request: Request) =>
  asViewer(async (viewerId) => {
    const folder = new URL(request.url).searchParams.get("folder");
    return Response.json(
      await getChats(viewerId, folder === "requests" ? "requests" : "inbox"),
    );
  });

/** One person: your 1:1 chat with them (made if new). More: a new group. */
export const POST = (request: Request) =>
  asViewer(async (viewerId) => {
    const parsed = newChatSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ message: "Invalid chat." }, { status: 400 });
    }
    const { userIds, name } = parsed.data;
    const id =
      userIds.length === 1
        ? await openDirect(viewerId, userIds[0]!)
        : await createGroup(viewerId, userIds, name);
    return Response.json({ id });
  });
