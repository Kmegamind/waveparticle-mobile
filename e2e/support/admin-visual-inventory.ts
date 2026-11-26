import { appendFileSync } from "node:fs";

// #483: the inventory of the admin visual gate, so a reshuffle of the gate (one spec file per page)
// can be checked to keep every comparison. One line per compared or skipped property of every
// component, per exception, per word-break-normal component, and per prototype and live page.
// Written only when ADMIN_VISUAL_INVENTORY names a file, while Playwright loads the spec files
// (`npx playwright test --project=desktop --list`); scripts/admin-visual-inventory.mjs runs it.

type InventorySide = { page: string; selector: string };
type InventoryComponent = {
  name: string;
  prototype: InventorySide;
  live: InventorySide;
  properties?: readonly string[];
  pseudo?: string;
  box?: readonly string[];
};
type InventoryException = { component: string; properties: readonly string[]; reason: string };
type InventoryPage = { hash?: string; file?: string; path?: string; prepare?: unknown };

export type InventoryInput = {
  components: readonly InventoryComponent[];
  exceptions: readonly InventoryException[];
  wordBreakNormal: ReadonlySet<string>;
  /** The component name of the exception that covers every component but WORD_BREAK_NORMAL. */
  everyComponentKey: string;
  defaultProperties: readonly string[];
  prototypePages: Record<string, InventoryPage>;
  livePages: Record<string, InventoryPage>;
};

const source = (value: unknown) =>
  typeof value === "function" ? value.toString().replace(/\s+/g, " ").trim() : "";

/** The inventory lines of one gate (unsorted). */
export function inventoryLines(input: InventoryInput): string[] {
  const lines: string[] = [];
  for (const component of input.components) {
    const skipped = new Set(
      input.exceptions
        .filter(
          (item) =>
            item.component === component.name ||
            (item.component === input.everyComponentKey &&
              !input.wordBreakNormal.has(component.name)),
        )
        .flatMap((item) => item.properties),
    );
    const properties = [
      ...(component.properties ?? input.defaultProperties),
      ...(component.box ?? []).map((metric) => `box ${metric}`),
    ];
    for (const property of properties) {
      lines.push(
        [
          "compare",
          component.name,
          `${component.prototype.page} ${component.prototype.selector}`,
          `${component.live.page} ${component.live.selector}`,
          component.pseudo ?? "",
          property,
          skipped.has(property) ? "skipped" : "compared",
        ].join("\t"),
      );
    }
  }
  for (const item of input.exceptions) {
    lines.push(["exception", item.component, item.properties.join(","), item.reason].join("\t"));
  }
  for (const name of input.wordBreakNormal) lines.push(["word-break-normal", name].join("\t"));
  for (const [key, page] of Object.entries(input.prototypePages)) {
    lines.push(
      ["prototype page", key, page.file ?? "", page.hash ?? "", source(page.prepare)].join("\t"),
    );
  }
  for (const [key, page] of Object.entries(input.livePages)) {
    lines.push(["live page", key, page.path ?? "", source(page.prepare)].join("\t"));
  }
  return lines;
}

/** Appends the gate's lines to the ADMIN_VISUAL_INVENTORY file, when it is set. */
export function recordInventory(input: InventoryInput): void {
  const file = process.env.ADMIN_VISUAL_INVENTORY;
  if (!file) return;
  appendFileSync(
    file,
    inventoryLines(input)
      .map((line) => `${line}\n`)
      .join(""),
  );
}
