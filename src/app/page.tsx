import FormsContainer from "@/components/forms/forms-container";
import OnboardingForm from "@/components/forms/onboarding-form";
import { Separator } from "@/components/ui/separator";
import { auth } from "@/server/auth";
import Image from "next/image";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  const { error } = await searchParams;
  // Signed-in users with a finished profile never get here: the proxy sends
  // them to the feed.
  const isOnboarding = Boolean(
    session?.user?.id && !session.user.profileComplete,
  );
  return (
    <main className="relative grid min-h-svh lg:grid-cols-2">
      <div className="relative hidden min-h-svh overflow-hidden lg:block">
        <Image
          src="/framey_banner.png"
          alt="Framey Banner"
          fill
          sizes="50vw"
          quality={100}
          priority
          className="object-cover object-center"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-90 bg-[linear-gradient(to_top,var(--background)_6%,color-mix(in_oklch,var(--background)_60%,transparent)_40%,transparent_72%)]"
        />
        <div className="absolute inset-x-12 bottom-12 flex flex-col gap-5">
          <Image
            src="/framey_white.png"
            alt="Framey Logo"
            width={100}
            height={100}
            className="h-auto w-11"
          />
          <h1 className="max-w-[16ch] text-[clamp(2rem,3vw,2.75rem)] font-bold leading-[1.1] tracking-[-0.02em] text-balance">
            Capture the moments that matter.
          </h1>
        </div>
      </div>
      <Separator
        orientation="vertical"
        className="absolute my-10 inset-0 mx-auto lg:block hidden bg-muted-foreground"
      />

      <div className="flex min-h-svh items-center px-6 py-10">
        <div className="mx-auto flex w-full max-w-136 -translate-x-16 gap-8 max-sm:translate-x-0 max-sm:gap-0">
          <div
            aria-hidden="true"
            className="w-px flex-none self-stretch bg-[linear-gradient(to_bottom,transparent,var(--border)_12%,var(--border)_88%,transparent)] max-sm:hidden"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-8">
            <Image
              src="/framey_white.png"
              alt="Framey"
              width={100}
              height={100}
              className="h-auto w-12"
            />
            {isOnboarding ? (
              <OnboardingForm />
            ) : (
              <FormsContainer
                authError={typeof error === "string" ? error : undefined}
              />
            )}
            <p className="text-[0.8125rem] leading-snug text-muted-foreground">
              Capture the moments that matter.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
