import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "./shell";

export const metadata: Metadata = {
  title: "WaveParticle",
  description: "Pick a companion, set a goal, and start.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="theme-shell min-h-full antialiased">
      <body className="min-h-full">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
