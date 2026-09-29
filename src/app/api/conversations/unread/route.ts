import { asViewer, getUnreadCounts } from "@/server/chat";

export const GET = () =>
  asViewer(async (viewerId) => Response.json(await getUnreadCounts(viewerId)));
