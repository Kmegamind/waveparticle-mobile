/**
 * REST-ROUND-10 (#518): the rest chat stops at the person's tenth message in one Pause. His reply
 * to it says that his own work is going to fail; after it he stops replying and the field is gone.
 */
export const REST_ROUNDS = 10;

/**
 * The one instruction added to call one (`rest_reply`) for the tenth reply of a Pause, after the
 * prompt. Proposed wording, for the owner to approve in the pull request of #518.
 */
export const REST_LAST_ROUND_INSTRUCTION = [
  "This turn: this is the person's tenth message in this pause, and this is his last reply.",
  "In this reply he says plainly that his own work here is going to fail.",
  "He talks only about his own side.",
  "He does not tell the person to go back, to work or to stop.",
].join("\n");
