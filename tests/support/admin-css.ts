import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

// #483: the admin's styles moved from src/app/globals.css to src/app/admin/admin.css (frame and
// shared components) and one file per admin page. Tests that read the admin's CSS read all of it:
// admin.css first, then every page file in path order.

const ADMIN = path.join(process.cwd(), "src/app/admin");

function cssFilesUnder(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) return cssFilesUnder(full);
    return entry.name.endsWith(".css") ? [full] : [];
  });
}

/** Every admin stylesheet, relative to the repository root: admin.css first. */
export function adminCssFiles(): string[] {
  const shared = path.join(ADMIN, "admin.css");
  const pages = cssFilesUnder(ADMIN)
    .filter((file) => file !== shared)
    .sort();
  return [shared, ...pages].map((file) => path.relative(process.cwd(), file));
}

/** The admin's CSS, all files joined. */
export function readAdminCss(): string {
  return adminCssFiles()
    .map((file) => readFileSync(path.join(process.cwd(), file), "utf8"))
    .join("\n\n");
}
