"use client";

import { useEffect } from "react";

type Doc = {
  getElementById(id: string): { scrollIntoView(options: ScrollIntoViewOptions): void } | null;
};

/** The Life Path opens on the current Story card (#96 AC5, FLOW CPAGE). */
export function scrollToCurrent(doc: Doc): void {
  doc.getElementById("current-story")?.scrollIntoView({ block: "center" });
}

export function OpenOnCurrent() {
  useEffect(() => scrollToCurrent(document), []);
  return null;
}
