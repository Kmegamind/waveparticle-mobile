/**
 * The display name's edit state on Me (#81, #392, #398), as a pure reducer so its behaviour can be
 * tested without a browser.
 *
 * - Save starts one request at a time: while it is pending, Save does nothing (no second
 *   classifier call, no second write) and the field is read-only.
 * - Cancel ends editing and drops the pending request: its answer, a crisis included, is ignored
 *   when it arrives (#398).
 * - Every Save clears the last announcement first, so "Display name saved" is never left over
 *   after a crisis or a failed save, and a second successful save is announced again.
 * - A crisis answer empties the field, keeps edit mode and asks the page to show S1 once
 *   (`crisisShown` goes up by one).
 */

export type SaveOutcome =
  { status: "ok"; name: string } | { status: "crisis" | "invalid" | "failed" };

export type DisplayNameState = {
  /** The saved name. */
  name: string;
  draft: string;
  editing: boolean;
  /** The id of the Save waiting for its answer, or null. */
  pending: number | null;
  /** The id the next Save gets. */
  nextRequest: number;
  error: string;
  announce: string;
  /** Goes up by one for each crisis answer; the page shows S1 when it changes. */
  crisisShown: number;
};

export type DisplayNameEvent =
  | { type: "edit" }
  | { type: "type"; text: string }
  | { type: "save" }
  | { type: "cancel" }
  | { type: "answer"; request: number; outcome: SaveOutcome };

export const SAVED_ANNOUNCEMENT = "Display name saved";
export const INVALID_ERROR = "Use 1 to 60 characters.";
export const FAILED_ERROR = "Could not save the name. Please try again.";

export function initialDisplayName(name: string): DisplayNameState {
  return {
    name,
    draft: name,
    editing: false,
    pending: null,
    nextRequest: 1,
    error: "",
    announce: "",
    crisisShown: 0,
  };
}

export function displayNameReducer(
  state: DisplayNameState,
  event: DisplayNameEvent,
): DisplayNameState {
  switch (event.type) {
    case "edit":
      return { ...state, editing: true, draft: state.name, error: "" };
    case "type":
      return state.pending === null ? { ...state, draft: event.text } : state;
    case "save":
      if (!state.editing || state.pending !== null) return state;
      return {
        ...state,
        pending: state.nextRequest,
        nextRequest: state.nextRequest + 1,
        announce: "",
      };
    case "cancel":
      return { ...state, editing: false, draft: state.name, error: "", pending: null };
    case "answer": {
      // An answer to a Save that was cancelled (or replaced) changes nothing.
      if (event.request !== state.pending) return state;
      const done = { ...state, pending: null };
      switch (event.outcome.status) {
        case "ok":
          return {
            ...done,
            name: event.outcome.name,
            draft: event.outcome.name,
            editing: false,
            error: "",
            announce: SAVED_ANNOUNCEMENT,
          };
        case "crisis":
          // Nothing was saved; the text is dropped and S1 shows. Back returns to edit mode.
          return { ...done, draft: "", error: "", crisisShown: state.crisisShown + 1 };
        case "invalid":
          // The typed text stays in the field (DESIGN 8, errors in words).
          return { ...done, error: INVALID_ERROR };
        default:
          return { ...done, error: FAILED_ERROR };
      }
    }
  }
}
