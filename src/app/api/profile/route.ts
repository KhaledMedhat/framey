import { and, eq } from "drizzle-orm";

import { AccountVisibility } from "@/interfaces/general.interface";

import { editProfileSchema, withScheme } from "@/lib/validations";
import { recordAccountChanges } from "@/server/activity";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import {
  followRequests,
  notifications,
  userFollows,
  users,
} from "@/server/db/schema";

/** Edit profile: any of name, websites, bio, gender and who can see the account. */
export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json(
      { message: "Sign in to edit your profile." },
      { status: 401 },
    );
  }

  const parsed = editProfileSchema.partial().safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  const { bio, websites, ...rest } = parsed.data;
  const userId = session.user.id;
  if (!Object.keys(parsed.data).length) return Response.json({ ok: true });
  const [before] = await db
    .select({
      firstName: users.firstName,
      lastName: users.lastName,
      bio: users.bio,
      websites: users.websites,
      gender: users.gender,
      visibility: users.visibility,
    })
    .from(users)
    .where(eq(users.id, userId));
  const [after] = await db
    .update(users)
    .set({
      ...rest,
      ...(bio !== undefined && { bio: bio || null }),
      ...(websites !== undefined && {
        websites: [...new Set(websites.filter(Boolean).map(withScheme))],
      }),
    })
    .where(eq(users.id, userId))
    .returning({
      firstName: users.firstName,
      lastName: users.lastName,
      bio: users.bio,
      websites: users.websites,
      gender: users.gender,
      visibility: users.visibility,
    });
  // "Account history" in Your activity.
  if (before && after) {
    await recordAccountChanges(userId, [
      {
        kind: "name",
        before: `${before.firstName} ${before.lastName}`,
        after: `${after.firstName} ${after.lastName}`,
      },
      { kind: "bio", before: before.bio, after: after.bio },
      {
        kind: "website",
        before: before.websites.join(", ") || null,
        after: after.websites.join(", ") || null,
      },
      { kind: "gender", before: before.gender, after: after.gender },
      { kind: "privacy", before: before.visibility, after: after.visibility },
    ]);
  }

  // Going public lets everyone waiting in.
  if (rest.visibility === AccountVisibility.PUBLIC) {
    const pending = await db
      .delete(followRequests)
      .where(eq(followRequests.targetId, userId))
      .returning({ id: followRequests.requesterId });
    if (pending.length) {
      await db.batch([
        db
          .insert(userFollows)
          .values(pending.map((p) => ({ followerId: p.id, followingId: userId })))
          .onConflictDoNothing(),
        db
          .update(notifications)
          .set({ type: "follow" })
          .where(
            and(
              eq(notifications.userId, userId),
              eq(notifications.type, "follow_request"),
            ),
          ),
      ]);
    }
  }
  return Response.json({ ok: true });
}
