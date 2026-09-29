import z from "zod";

import { auth } from "@/server/auth";
import { getRandomReels } from "@/server/feed";

const excludeSchema = z.array(z.uuid()).max(200);

/** A few random reels: `?exclude=<id>,<id>` skips the ones already shown. */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ message: "Sign in to watch reels." }, { status: 401 });
  }
  const raw = new URL(request.url).searchParams.get("exclude");
  const exclude = excludeSchema.safeParse(raw ? raw.split(",") : []);
  if (!exclude.success) {
    return Response.json({ message: "Invalid exclude list." }, { status: 400 });
  }
  return Response.json(await getRandomReels(session.user.id, exclude.data));
}
