import z from "zod";

import { auth } from "@/server/auth";
import { getStoryViewers } from "@/server/stories";

/** The author's "Seen by" list. */
export async function GET(_: Request, ctx: RouteContext<"/api/stories/[id]/viewers">) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ message: "Sign in first." }, { status: 401 });
  }
  const id = z.uuid().safeParse((await ctx.params).id);
  const viewers = id.success ? await getStoryViewers(session.user.id, id.data) : null;
  if (!viewers) {
    return Response.json({ message: "Story not found." }, { status: 404 });
  }
  return Response.json(viewers);
}
