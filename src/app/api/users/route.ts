import { and, asc, eq, ilike, or } from "drizzle-orm";
import z from "zod";

import { auth } from "@/server/auth";
import { notBlocked } from "@/server/blocks";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";

const querySchema = z.string().trim().min(1).max(50);

/** `?q=`: accounts whose username or name contains the query. */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ message: "Sign in to search." }, { status: 401 });
  }
  const q = querySchema.safeParse(new URL(request.url).searchParams.get("q"));
  if (!q.success) return Response.json([]);
  // Escape LIKE wildcards so "_" and "%" match themselves.
  const pattern = `%${q.data.replace(/[\\%_]/g, "\\$&")}%`;
  const found = await db.query.users.findMany({
    where: and(
      eq(users.profileComplete, true),
      notBlocked(users.id, session.user.id),
      or(
        ilike(users.username, pattern),
        ilike(users.firstName, pattern),
        ilike(users.lastName, pattern),
      ),
    ),
    orderBy: asc(users.username),
    limit: 20,
    columns: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      profilePicture: true,
    },
  });
  return Response.json(found);
}
