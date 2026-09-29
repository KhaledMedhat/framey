import { SettingsNav } from "@/components/shell/settings";

/** Sections on the side, the open one beside them (stacked on a phone). */
export default function SettingsLayout({ children }: LayoutProps<"/settings">) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col md:flex-row">
      <SettingsNav />
      <section className="min-w-0 flex-1 px-4 pt-6 pb-10 md:px-12 md:pt-10">
        {children}
      </section>
    </div>
  );
}
