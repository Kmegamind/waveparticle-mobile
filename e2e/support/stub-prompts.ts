import type { APIRequestContext } from "@playwright/test";
import { e2ePorts } from "./ports";

// The prompts the stub model (stub-model.mjs) has received. Its list is shared by every live test
// running at the same time and never reset, and the live server, not the test, makes the calls,
// so a prompt cannot say which test it came from. A test therefore never reads "the last prompt":
// it takes a mark before its own action and reads only the prompts recorded since then (#377).

const STUB = `http://127.0.0.1:${e2ePorts.stub}`;

/** Every prompt the stub model has received, oldest first. */
export async function stubPrompts(request: APIRequestContext): Promise<string[]> {
  return (await (await request.get(`${STUB}/prompts`)).json()) as string[];
}

/** A mark before the test's own action: the number of prompts recorded so far. */
export async function promptMark(request: APIRequestContext): Promise<number> {
  return (await stubPrompts(request)).length;
}

/** The prompts recorded since `mark`, oldest first. */
export async function promptsSince(request: APIRequestContext, mark: number): Promise<string[]> {
  return (await stubPrompts(request)).slice(mark);
}
