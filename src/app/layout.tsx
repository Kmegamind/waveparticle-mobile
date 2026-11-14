import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PREFS_SCRIPT } from "@/lib/me/prefs";
import { fontVariables } from "./fonts";
import { AppShell } from "./shell";

export const metadata: Metadata = {
  title: "WaveParticle",
  description: "Pick a companion, set a goal, and start.",
  applicationName: "WaveParticle",
  appleWebApp: {
    capable: true,
    title: "WaveParticle",
    statusBarStyle: "default",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The script applies this device's Appearance and Plain text (#83) before the first paint; it
    // changes the classes on <html>, so React is told not to compare them.
    <html
      lang="en"
      className={`theme-shell min-h-full antialiased ${fontVariables}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREFS_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
