import { and, count, eq } from "drizzle-orm";

import { AccountVisibility } from "@/interfaces/general.interface";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { followRequests, userFollows } from "@/server/db/schema";
import { notify, unnotify } from "@/server/notifications";
import { getFollowList, getProfile } from "@/server/profile";
import { rateLimit, tooManyRequests } from "@/server/ratelimit";

type Ctx = RouteContext<"/api/users/[username]/follow">;

/** The signed-in viewer and the profile in the URL, or the error response. */
async function load(ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ message: "Sign in to follow people." }, { status: 401 });
  }
  const username = decodeURIComponent((await ctx.params).username).toLowerCase();
  const profile = await getProfile(session.user.id, username);
  if (!profile) {
    return Response.json({ message: "Account not found." }, { status: 404 });
  }
  return { viewerId: session.user.id, profile };
}

/** `?list=followers|following`: the people behind a profile's counts. */
export async function GET(request: Request, ctx: Ctx) {
  const loaded = await load(ctx);
  if (loaded instanceof Response) return loaded;
  const list = new URL(request.url).searchParams.get("list");
  if (list !== "followers" && list !== "following") {
    return Response.json({ message: "Unknown list." }, { status: 400 });
  }
  // A private account's connections are as private as its posts.
  if (!loaded.profile.canView) {
    return Response.json({ message: "This account is private." }, { status: 403 });
  }
  return Response.json(await getFollowList(loaded.profile.id, list));
}

async function toggle(follow: boolean, ctx: Ctx) {
  const loaded = await load(ctx);
  if (loaded instanceof Response) return loaded;
  const { viewerId, profile } = loaded;
  // Follow/unfollow loops would spam the other person with notifications.
  const retryAfter = await rateLimit("follow", viewerId);
  if (retryAfter) return tooManyRequests(retryAfter);
  if (profile.isMe) {
    return Response.json({ message: "You can't follow yourself." }, { status: 400 });
  }
  if (follow && profile.blocked) {
    return Response.json(
      { message: `Unblock @${profile.username} to follow them.` },
      { status: 403 },
    );
  }

  const key = { followerId: viewerId, followingId: profile.id };
  let requested = false;
  if (follow && profile.following) {
    // Already following: nothing to do.
  } else if (follow && profile.visibility === AccountVisibility.PRIVATE) {
    // Private: a request they approve from their notifications.
    const [created] = await db
      .insert(followRequests)
      .values({ requesterId: viewerId, targetId: profile.id })
      .onConflictDoNothing()
      .returning({ id: followRequests.requesterId });
    if (created) await notify(profile.id, viewerId, "follow_request");
    requested = true;
  } else if (follow) {
    const [created] = await db
      .insert(userFollows)
      .values(key)
      .onConflictDoNothing()
      .returning({ id: userFollows.followerId });
    if (created) await notify(profile.id, viewerId, "follow");
  } else {
    // Unfollow also withdraws a pending request.
    await db.batch([
      db
        .delete(userFollows)
        .where(
          and(
            eq(userFollows.followerId, key.followerId),
            eq(userFollows.followingId, key.followingId),
          ),
        ),
      db
        .delete(followRequests)
        .where(
          and(
            eq(followRequests.requesterId, viewerId),
            eq(followRequests.targetId, profile.id),
          ),
        ),
    ]);
    await Promise.all([
      unnotify(profile.id, viewerId, "follow"),
      unnotify(profile.id, viewerId, "follow_request"),
    ]);
  }

  const [{ followers }] = await db
    .select({ followers: count() })
    .from(userFollows)
    .where(eq(userFollows.followingId, profile.id));
  return Response.json({
    following: follow && !requested,
    requested,
    followers,
  });
}

export const POST = (_: Request, ctx: Ctx) => toggle(true, ctx);
export const DELETE = (_: Request, ctx: Ctx) => toggle(false, ctx);
