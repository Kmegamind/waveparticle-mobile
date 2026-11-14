/** Where the shared session pages lead (#257): /try and the signed-in pages differ only here. */
export type SessionPaths = {
  home: string;
  homeLabel: string;
  focus: string;
  rest: string;
  /** The page after the last Done; null keeps the Undo toast on the focus page. */
  end: string | null;
};

export const TRY_PATHS: SessionPaths = {
  home: "/try",
  homeLabel: "Go back to the test home",
  focus: "/try/focus",
  rest: "/try/rest",
  end: "/try/end",
};

export const ACCOUNT_PATHS: SessionPaths = {
  home: "/",
  homeLabel: "Go back to Home",
  focus: "/focus",
  rest: "/rest",
  end: null,
};

/** The signed-in pages of one account session: the last Done opens its summary (#258). */
export function accountPathsFor(sessionId: string): SessionPaths {
  return { ...ACCOUNT_PATHS, end: `/end?session=${encodeURIComponent(sessionId)}` };
}
