import { and, eq, notInArray, or, sql, type AnyColumn } from "drizzle-orm";

import { db } from "@/server/db";
import { userBlocks } from "@/server/db/schema";

/**
 * `column` (a user id) is someone the viewer hasn't blocked and who hasn't
 * blocked the viewer. Blocks cut both ways, like Instagram's.
 */
export const notBlocked = (column: AnyColumn, viewerId: string) =>
  and(
    notInArray(
      column,
      db
        .select({ id: userBlocks.blockedId })
        .from(userBlocks)
        .where(eq(userBlocks.blockerId, viewerId)),
    ),
    notInArray(
      column,
      db
        .select({ id: userBlocks.blockerId })
        .from(userBlocks)
        .where(eq(userBlocks.blockedId, viewerId)),
    ),
  );

/** Who blocked whom between two people, if anyone. */
export async function blockBetween(a: string, b: string) {
  const rows = await db
    .select({ blockerId: userBlocks.blockerId })
    .from(userBlocks)
    .where(
      or(
        and(eq(userBlocks.blockerId, a), eq(userBlocks.blockedId, b)),
        and(eq(userBlocks.blockerId, b), eq(userBlocks.blockedId, a)),
      ),
    );
  return {
    /** `a` blocked `b`. */
    blocked: rows.some((r) => r.blockerId === a),
    /** `b` blocked `a`. */
    blockedBy: rows.some((r) => r.blockerId === b),
  };
}

export const isBlockedEitherWay = (a: string, b: string) =>
  blockBetween(a, b).then((r) => r.blocked || r.blockedBy);

/** Everyone the user blocked, newest first. */
export const getBlockedAccounts = (userId: string) =>
  db.query.userBlocks.findMany({
    where: eq(userBlocks.blockerId, userId),
    orderBy: sql`${userBlocks.createdAt} desc`,
    columns: {},
    with: {
      blocked: {
        columns: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          profilePicture: true,
        },
      },
    },
  }).then((rows) => rows.map((r) => r.blocked));
