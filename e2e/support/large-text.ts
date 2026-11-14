import type { Page } from "@playwright/test";

// #100: every size token is in rem, so a 200% root font is what a person gets from the browser's
// text size setting at 200%.

/** Sets the text size to 200% on the loaded page and waits for the layout to settle. */
export async function largeText(page: Page) {
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}

/**
 * Elements that end past the right edge of the screen, and elements that hide part of their own
 * content (overflow hidden or clip, or an ellipsis). Screen-reader-only text, fixed bars and
 * scrolling areas are not counted: a scrolling area shows the rest when scrolled.
 */
export async function overflowReport(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const found: string[] = [];
    const name = (element: Element) =>
      `${element.tagName.toLowerCase()}.${String(element.className).trim().replace(/\s+/g, ".")}`;
    for (const element of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
      if (element.closest(".sr-only, [hidden], dialog:not([open]), script, style")) continue;
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      if (box.width === 0 || box.height === 0 || style.visibility === "hidden") continue;
      // Inside a tab strip that scrolls sideways (the Goals tabs), the rest shows when scrolled.
      const strip = element.closest<HTMLElement>('[role="tablist"]');
      const inStrip =
        strip !== null && strip !== element && getComputedStyle(strip).overflowX === "auto";
      if (box.right > window.innerWidth + 1 && style.position !== "fixed" && !inStrip) {
        found.push(`past the edge: ${name(element)} ends at ${Math.round(box.right)}`);
      }
      const clipsX = ["hidden", "clip"].includes(style.overflowX);
      const clipsY = ["hidden", "clip"].includes(style.overflowY);
      const ellipsis = style.textOverflow === "ellipsis";
      // A round portrait crops its image on purpose; only text can be cut off.
      const hasText = Boolean(element.textContent?.trim());
      if (
        hasText &&
        (((clipsX || ellipsis) && element.scrollWidth > element.clientWidth + 1) ||
          (clipsY && element.scrollHeight > element.clientHeight + 1))
      ) {
        found.push(
          `cut off: ${name(element)} ${element.scrollWidth}x${element.scrollHeight} in ${element.clientWidth}x${element.clientHeight}`,
        );
      }
    }
    return found;
  });
}
