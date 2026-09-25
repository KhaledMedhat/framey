import { postCursorSchema } from "@/lib/validations";
import { auth } from "@/server/auth";
import { getFeedPage } from "@/server/feed";

/** Next page of the viewer's feed: `?createdAt=<iso>&id=<uuid>` from `nextCursor`. */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ message: "Sign in to see your feed." }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const cursor = params.has("id")
    ? postCursorSchema.safeParse(Object.fromEntries(params))
    : null;
  if (cursor && !cursor.success) {
    return Response.json({ message: "Invalid cursor." }, { status: 400 });
  }

  const page = await getFeedPage(
    session.user.id,
    cursor?.data && {
      createdAt: cursor.data.createdAt.toISOString(),
      id: cursor.data.id,
    },
  );
  return Response.json(page);
}
