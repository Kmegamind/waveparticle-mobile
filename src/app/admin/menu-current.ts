/**
 * #435: the menu row of the page shown is marked, and on a detail page (for example
 * /admin/prompts/plan_split) the row it belongs to, as in the prototype.
 */
export function menuCurrent(pathname: string, href: string): "page" | "true" | undefined {
  if (pathname === href) return "page";
  if (pathname.startsWith(`${href}/`)) return "true";
  return undefined;
}
