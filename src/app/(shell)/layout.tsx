import Nav from "@/components/shell/nav";
import { auth, signOut } from "@/server/auth";

/** Chrome shared by every signed-in page (the proxy keeps everyone else out). */
export default async function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <div className="min-h-svh">
      <Nav username={session?.user?.username ?? ""} user={session?.user} logout={logout} />
      {/* Offsets match the nav: 72px rail on desktop, 56px tab bar (plus the
          home-indicator inset) on mobile. */}
      <main className="pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0 md:pl-18">
        {children}
      </main>
    </div>
  );
}
