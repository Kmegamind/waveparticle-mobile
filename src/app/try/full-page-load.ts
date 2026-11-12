/**
 * Moves between the session pages of the test path (/try/focus, /try/rest, /try/end) with a full
 * page load. With `cacheComponents` on, a client navigation keeps the page being left alive in a
 * hidden React Activity with its state; coming back would show that older state and write it over
 * what the other page stored. A full load makes every page read the session from storage again.
 */
export function fullPageLoad(href: string): void {
  window.location.assign(href);
}
