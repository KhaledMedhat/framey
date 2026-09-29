import type { Metadata } from "next";

import { ChatThread } from "@/components/shell/chat";
import { getT } from "@/server/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("messages") };
}

export default async function ChatPage({ params }: PageProps<"/direct/[id]">) {
  const { id } = await params;
  return <ChatThread key={id} id={id} />;
}
