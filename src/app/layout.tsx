import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import StoreProviders from "@/components/store-providers";
import { ThemeProvider } from "next-themes";
import { I18nProvider } from "@/components/i18n-provider";
import { isRtl } from "@/lib/i18n";
import { getLang } from "@/server/i18n";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Framey", template: "%s • Framey" },
  description: "Capture the moments that matter.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const lang = await getLang();
  return (
    <html
      lang={lang}
      dir={isRtl(lang) ? "rtl" : "ltr"}
      suppressHydrationWarning
      className={cn(
        "h-full",
        "antialiased",
        geistSans.variable,
        geistMono.variable,
        "font-sans",
        inter.variable,
        "dark",
      )}
    >
      <body className="min-h-full flex flex-col">
        <StoreProviders>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            <I18nProvider lang={lang}>
              <TooltipProvider>{children}</TooltipProvider>
              <Toaster />
            </I18nProvider>
          </ThemeProvider>
        </StoreProviders>
      {/* impeccable-live-start */}
<script src="http://localhost:8400/live.js?token=657819c8-1b5c-4668-be7a-bfe16df2c811"></script>
{/* impeccable-live-end */}
</body>
    </html>
  );
}
