import { auth } from "@/server/auth";
import { getProfile, getProfilePosts } from "@/server/profile";

/** A profile's hover card: the header as the profile shows it, plus the last 3 posts if visible. */
export async function GET(
  _: Request,
  ctx: RouteContext<"/api/users/[username]">,
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ message: "Sign in first." }, { status: 401 });
  }
  const username = decodeURIComponent((await ctx.params).username).toLowerCase();
  const profile = await getProfile(session.user.id, username);
  if (!profile) {
    return Response.json({ message: "Account not found." }, { status: 404 });
  }
  const { posts } = profile.canView
    ? await getProfilePosts(session.user.id, profile.id, "posts", 3)
    : { posts: [] };
  return Response.json({ ...profile, posts });
}
