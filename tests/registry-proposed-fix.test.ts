import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseRegistrySeed,
  registrySeedSql,
  withoutProposedVersions,
} from "../scripts/ai-features/registry-seed.mjs";
import {
  proposedCheckSql,
  proposedFixes,
  proposedFixSql,
  proposedUndoSql,
} from "../scripts/ai-features/registry-proposed-fix.mjs";

// #491 (AI-PROPOSED-SEED-TEXT): the registry shows the published prompt versions, not the proposed
// ones. Invented text in the shape of the owner's seed; the real seed is never committed.

const root = path.join(import.meta.dirname, "..");
const SEED = path.join(root, "tests", "fixtures", "ai-registry", "registry-seed.json");

/** The fixture seed with invented room-to-improve notes that name proposed versions. */
function seedWithProposedNotes() {
  const seed = JSON.parse(readFileSync(SEED, "utf8"));
  const notes: Record<string, string> = {
    "R-02": "Proposed v4: invented idea one, invented idea two.",
    "R-03": "Invented rule; roleplay format proposed.",
    "R-04": "Another invented rule; roleplay format proposed.",
    "R-05": "Invented; roleplay format proposed.",
  };
  for (const row of seed.rows) if (notes[row.id]) row.room_to_improve = notes[row.id];
  return seed;
}

describe("#491 proposed prompt versions in the registry seed", () => {
  it("test_491_the_seed_text_names_no_proposed_version", () => {
    expect(withoutProposedVersions("Proposed v4: invented idea.")).toBe("Invented idea.");
    expect(withoutProposedVersions("Invented; roleplay format proposed.")).toBe(
      "Invented; roleplay format.",
    );
    expect(withoutProposedVersions("Invented idea for R-01.")).toBe("Invented idea for R-01.");
    const rows = parseRegistrySeed(seedWithProposedNotes());
    const byId = Object.fromEntries(rows.map((row) => [row.feature_id, row]));
    expect(byId["R-02"].room_to_improve).toBe("Invented idea one, invented idea two.");
    expect(byId["R-05"].room_to_improve).toBe("Invented; roleplay format.");
    expect(registrySeedSql(rows)).not.toMatch(/proposed/i);
  });

  it("test_491_a_proposed_version_left_in_the_seed_is_refused", () => {
    const seed = seedWithProposedNotes();
    seed.rows.find((row: { id: string }) => row.id === "R-04").room_to_improve =
      "Use the proposed4 text.";
    expect(() => parseRegistrySeed(seed)).toThrow(/R-04: room_to_improve still names a proposed/);
  });

  it("test_491_fix_changes_only_the_old_text_and_undo_restores_it_exactly", () => {
    const fixes = proposedFixes(seedWithProposedNotes());
    expect(fixes.map((fix) => `${fix.feature_id} ${fix.slug} ${fix.column}`)).toEqual([
      "R-02 step_cards room_to_improve",
      "R-03 pause_message room_to_improve",
      "R-04 rest_reply room_to_improve",
      "R-05 return_popup room_to_improve",
    ]);
    const sql = proposedFixSql(fixes);
    expect(sql).toMatch(/^begin;$/m);
    expect(sql).toMatch(/^commit;$/m);
    expect(sql).toContain(
      "set room_to_improve = $seed$Invented idea one, invented idea two.$seed$\nwhere slug = 'step_cards' and feature_id = 'R-02' and room_to_improve = $seed$Proposed v4: invented idea one, invented idea two.$seed$;",
    );
    const undo = proposedUndoSql(fixes);
    expect(undo).toContain(
      "set room_to_improve = $seed$Proposed v4: invented idea one, invented idea two.$seed$\nwhere slug = 'step_cards' and feature_id = 'R-02' and room_to_improve = $seed$Invented idea one, invented idea two.$seed$;",
    );
    expect(undo).toMatch(/^commit;$/m);
  });

  it("test_491_dry_run_ends_in_rollback_and_check_is_read_only", () => {
    const fixes = proposedFixes(seedWithProposedNotes());
    const dry = proposedFixSql(fixes, { dryRun: true });
    expect(dry).toMatch(/^rollback;$/m);
    expect(dry).not.toMatch(/^commit;$/m);
    const check = proposedCheckSql(fixes);
    expect(check).not.toMatch(/\b(update|insert|delete|begin|commit)\b/i);
    expect(check).toContain("'fixed'");
  });

  it("test_491_a_seed_without_proposed_versions_needs_no_fix", () => {
    expect(proposedFixes(JSON.parse(readFileSync(SEED, "utf8")))).toEqual([]);
  });
});
