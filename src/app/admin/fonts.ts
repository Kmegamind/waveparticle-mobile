import { Fraunces, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

// The admin prototype's three typefaces (#435), for the admin only. The prototype asks Google
// Fonts for IBM Plex Sans 400/500/600, IBM Plex Mono 400/500 and Fraunces with the optical size
// axis (9..144) at 500/600. next/font downloads them at build time and serves them from this site,
// so the browser never calls Google. The CSS variables feed the --adm-font-* tokens in tokens.css,
// which resolve on the admin shell, the element that carries these classes.
//
// Fraunces: next/font only takes the optical size axis together with the variable weight, so the
// whole weight range of that one file is loaded; the admin uses 500 and 600 of it.
const display = Fraunces({
  axes: ["opsz"],
  display: "swap",
  subsets: ["latin"],
  variable: "--font-adm-display",
});

const body = IBM_Plex_Sans({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-adm-body",
  weight: ["400", "500", "600"],
});

const mono = IBM_Plex_Mono({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-adm-mono",
  weight: ["400", "500"],
});

export const adminFontVariables = [display, body, mono].map((font) => font.variable).join(" ");
