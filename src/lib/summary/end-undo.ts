import { canUndo, isFinished, undoDone, type FocusSession } from "@/lib/prototype/session";

/**
 * The Undo toast on the summary (END, #27 AC4). The last Done opens /end while its toast is still
 * running; the toast there is the same one, with the same time, read from this device's session.
 */

/** True while this device's finished session can still undo its last Done. */
export function summaryUndoOpen(device: FocusSession | null, nowMs: number): boolean {
  return device !== null && isFinished(device) && canUndo(device, nowMs);
}

/**
 * Undoes the last Done from the summary: the last Step returns with its clock from the value it
 * had at Done, after the 1.2 second hold. `heldMs` is the time the toast had left when it was
 * held (focus or hover), so a held toast does not run out. Null when there is nothing to undo.
 */
export function summaryUndo(
  device: FocusSession | null,
  nowMs: number,
  heldMs: number | null,
): FocusSession | null {
  if (!device || !isFinished(device) || !device.undo) return null;
  const base =
    heldMs !== null ? { ...device, undo: { ...device.undo, untilMs: nowMs + heldMs } } : device;
  const next = undoDone(base, nowMs);
  return next === base ? null : next;
}

export type ReopenOutcome = "reopened" | "nothing" | "failed";

/**
 * Undo on the summary, in order: wait for every write the summary started on arrival (the last
 * Done's progress and the closing line), then write the reopened run to the account, and only
 * then keep it on this device. Waiting keeps a late arrival write from finishing the run again or
 * wiping a stored closing line. If the account write fails, this device keeps the finished run.
 */
export async function reopenFromSummary(input: {
  device: FocusSession | null;
  nowMs: number;
  heldMs: number | null;
  pending: Promise<unknown>;
  record: (back: FocusSession) => Promise<boolean>;
  save: (back: FocusSession) => void;
}): Promise<ReopenOutcome> {
  const back = summaryUndo(input.device, input.nowMs, input.heldMs);
  if (!back) return "nothing";
  await input.pending.catch(() => undefined);
  const reopened = await input.record(back).catch(() => false);
  if (!reopened) return "failed";
  input.save(back);
  return "reopened";
}
