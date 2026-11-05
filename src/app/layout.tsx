import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "WaveParticle",
  description: "Pick a companion, set a goal, and start.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="theme-shell min-h-full antialiased">
      <body className="min-h-full flex flex-col">
        <header className="flex items-center gap-[var(--space-small-gap)] px-[var(--space-screen-inline)] py-[var(--space-small-gap)]">
          <Link aria-label="WaveParticle" href="/">
            <Image className="logo" src="/logo.svg" alt="" width={54} height={20} />
          </Link>
          <span className="font-[var(--type-display)] text-[var(--text-button-size)] font-extrabold tracking-[-0.02em]">
            WaveParticle
          </span>
        </header>
        {children}
      </body>
    </html>
  );
}
