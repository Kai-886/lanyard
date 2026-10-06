import type { Metadata, Viewport } from "next";
import { Archivo, JetBrains_Mono, Public_Sans } from "next/font/google";
import { Providers } from "@/components/providers";
import { AppHeader } from "@/components/app-header";
import { CommandPalette } from "@/components/command-palette";
import { ToastProvider } from "@/components/toast";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-archivo",
  display: "swap",
});

const publicSans = Public_Sans({
  subsets: ["latin"],
  variable: "--font-public-sans",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Lanyard — AI Event Lead Manager",
    template: "%s · Lanyard",
  },
  description:
    "Capture the people you meet at events, recover the context, and ship the follow-up. Badges in, follow-ups out.",
  applicationName: "Lanyard",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F2EFE7" },
    { media: "(prefers-color-scheme: dark)", color: "#0E0D0C" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${archivo.variable} ${publicSans.variable} ${jetbrains.variable}`}
    >
      <body className="grain min-h-dvh antialiased">
        <Providers>
          <ToastProvider>
            <a
              href="#main"
              className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-100 focus:bg-signal focus:px-4 focus:py-2 focus:text-on-signal"
            >
              Skip to content
            </a>
            <AppHeader />
            <main
              id="main"
              className="mx-auto w-full max-w-[1440px] px-4 pb-28 sm:px-6 lg:px-8"
            >
              {children}
            </main>
            <CommandPalette />
          </ToastProvider>
        </Providers>
      </body>
    </html>
  );
}
