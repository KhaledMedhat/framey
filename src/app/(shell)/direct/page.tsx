import type { Metadata } from "next";

import { DirectEmpty } from "@/components/shell/chat";
import { getT } from "@/server/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("messages") };
}

/** A phone shows only the inbox here; a desktop invites you to start a chat. */
export default function DirectPage() {
  return <DirectEmpty />;
}
