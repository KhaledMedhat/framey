import { and, eq, ne } from "drizzle-orm";

import { ConflictCause } from "@/interfaces/api.interface";
import { completeProfileSchema } from "@/lib/validations";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { rateLimit, tooManyRequests } from "@/server/ratelimit";

const usernameTaken = () =>
  Response.json(
    {
      message: ConflictCause.USERNAME,
      errors: [{ field: "username", message: ConflictCause.USERNAME }],
    },
    { status: 409 },
  );

/** Google sign-up, step 2: the adapter already created the row; claim a username. */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json(
      { message: "Your session expired. Sign in with Google again to continue." },
      { status: 401 },
    );
  }

  const retryAfter = await rateLimit("completeProfile", session.user.id);
  if (retryAfter) return tooManyRequests(retryAfter);

  const parsed = completeProfileSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  const username = parsed.data.username.toLowerCase();
  const [taken] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.username, username), ne(users.id, session.user.id)))
    .limit(1);
  if (taken) return usernameTaken();

  try {
    const [user] = await db
      .update(users)
      .set({ username, profileComplete: true })
      .where(eq(users.id, session.user.id))
      .returning({ username: users.username });
    return Response.json(user);
  } catch (error) {
    // Someone claimed the same username between the check and the update.
    const cause = (error as { cause?: { code?: string } }).cause;
    if (cause?.code === "23505") return usernameTaken();
    throw error;
  }
}
