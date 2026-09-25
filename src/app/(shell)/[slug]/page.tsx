import type { Metadata } from "next";

import Feed from "@/components/shell/feed";
import Profile, { profileMetadata } from "@/components/shell/profile";
import { FEED_SLUG } from "@/lib/utils";

// Page params arrive URL-encoded ("/@me" gives "%40me"). Malformed escapes
// never get here: Next answers them with a 400 first.
const getHandle = async (params: PageProps<"/[slug]">["params"]) =>
  decodeURIComponent((await params).slug);

export async function generateMetadata({
  params,
}: PageProps<"/[slug]">): Promise<Metadata> {
  const handle = await getHandle(params);
  return handle === FEED_SLUG ? { title: "Feed" } : profileMetadata(handle);
}

/** `/@me` is the signed-in user's feed; any other handle is a profile. */
export default async function HandlePage({ params }: PageProps<"/[slug]">) {
  const handle = await getHandle(params);
  return handle === FEED_SLUG ? <Feed /> : <Profile username={handle} />;
}
