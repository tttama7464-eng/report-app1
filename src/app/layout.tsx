import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { TopNav } from "@/components/layout/top-nav";
import { BottomNav } from "@/components/layout/bottom-nav";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Sense — Follow your instinct",
  description:
    "Sense collects and visualizes human intuition through simple binary choices. Left or right — just decide.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider>
          <AuthProvider initialUser={user}>
            <TopNav />
            <main className="min-h-dvh pb-[calc(4.25rem+env(safe-area-inset-bottom))] md:pb-0 md:pt-16">
              {children}
            </main>
            {/* Feed height math: mobile pb-[4.25rem+safe-area] + Feed's own
                h-[calc(100dvh-4.25rem)] ≈ 100dvh; desktop pt-16 + Feed's
                h-[calc(100dvh-4rem)] = 100dvh. See feed.tsx. */}
            <BottomNav />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
