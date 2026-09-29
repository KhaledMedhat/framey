import { and, eq } from "drizzle-orm";
import z from "zod";

import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { closeFriends } from "@/server/db/schema";
import { getCloseFriendChoices } from "@/server/profile";

const unauthorized = () =>
  Response.json({ message: "Sign in first." }, { status: 401 });

/** Your followers, each marked when they're a close friend. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();
  return Response.json(await getCloseFriendChoices(session.user.id));
}

const toggleSchema = z.object({ userId: z.string().min(1), close: z.boolean() });

/** `{ userId, close }`: adds someone to, or drops them from, close friends. */
export async function PATCH(request: Request) {
  const session = await auth();
  const me = session?.user?.id;
  if (!me) return unauthorized();
  const parsed = toggleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.userId === me) {
    return Response.json({ message: "Invalid input." }, { status: 400 });
  }
  const { userId, close } = parsed.data;
  if (close) {
    // A bogus id fails the foreign key and changes nothing.
    const added = await db
      .insert(closeFriends)
      .values({ userId: me, friendId: userId })
      .onConflictDoNothing()
      .then(() => true)
      .catch(() => false);
    if (!added) {
      return Response.json({ message: "Account not found." }, { status: 404 });
    }
  } else {
    await db
      .delete(closeFriends)
      .where(and(eq(closeFriends.userId, me), eq(closeFriends.friendId, userId)));
  }
  return Response.json({ close });
}
