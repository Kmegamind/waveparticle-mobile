import {
  Atkinson_Hyperlegible_Mono,
  Atkinson_Hyperlegible_Next,
  Bricolage_Grotesque,
  Newsreader,
} from "next/font/google";

// The four typefaces of prototype version 4 (#240 C1). next/font downloads them at build time and
// serves them from this site, so the browser never calls Google. The CSS variables feed the
// --type-* tokens in tokens.css.
const atkinsonNext = Atkinson_Hyperlegible_Next({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-atkinson-next",
});

const atkinsonMono = Atkinson_Hyperlegible_Mono({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-atkinson-mono",
});

const bricolage = Bricolage_Grotesque({
  axes: ["opsz"],
  display: "swap",
  subsets: ["latin"],
  variable: "--font-bricolage",
});

const newsreader = Newsreader({
  axes: ["opsz"],
  display: "swap",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-newsreader",
});

export const fontVariables = [atkinsonNext, atkinsonMono, bricolage, newsreader]
  .map((font) => font.variable)
  .join(" ");
