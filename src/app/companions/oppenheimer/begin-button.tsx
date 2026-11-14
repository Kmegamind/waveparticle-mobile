"use client";

import { clearSession } from "@/lib/prototype/session";
import { emptyPrototypeState, savePrototypeState } from "@/lib/prototype/store";
import { clearSummaryRecord } from "@/lib/summary/run";
import { fullPageLoad } from "../../try/full-page-load";

/**
 * Begin on the current Story card (#258, #50). The goal dialogue reads the story from the browser
 * Plan store (#254), so Begin starts a fresh Plan for this story and then opens /goal.
 */
export function BeginButton({ storyId }: { storyId: string }) {
  function onBegin() {
    savePrototypeState(window.localStorage, { ...emptyPrototypeState(), storyId });
    clearSession(window.localStorage);
    clearSummaryRecord(window.localStorage);
    fullPageLoad("/goal");
  }
  return (
    <button className="button-filled" onClick={onBegin} type="button">
      Begin
    </button>
  );
}
