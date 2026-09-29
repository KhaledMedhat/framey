import { DirectInbox } from "@/components/shell/chat";

/** Chats on the side, the open one beside them (only one of the two on a phone). */
export default function DirectLayout({ children }: LayoutProps<"/direct">) {
  return (
    <div className="mx-auto flex h-[calc(100svh-3.5rem-env(safe-area-inset-bottom))] w-full max-w-7xl md:h-svh">
      <DirectInbox />
      <section className="min-w-0 flex-1">{children}</section>
    </div>
  );
}
