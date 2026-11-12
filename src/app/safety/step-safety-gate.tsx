"use client";

import { useState, useSyncExternalStore } from "react";
import { backToStep, submitStepDraft } from "@/lib/safety/crisis";
import { CrisisPage } from "./crisis-page";

const noSubscription = () => () => {};

export function StepSafetyGate() {
  const [draft, setDraft] = useState("");
  const [screen, setScreen] = useState<"step" | "crisis">("step");
  // False in the server HTML and during hydration, true once React has taken over the form.
  // Before that, Send is an ordinary browser submit that reloads the page.
  const ready = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = submitStepDraft(draft);
    setDraft(next.draft);
    setScreen(next.screen);
  }

  if (screen === "crisis") {
    return (
      <CrisisPage
        onBack={() => {
          const next = backToStep();
          setDraft(next.draft);
          setScreen(next.screen);
        }}
      />
    );
  }

  return (
    <main className="app-screen step-screen">
      <h1>Step</h1>
      <form data-ready={ready ? "true" : "false"} onSubmit={onSubmit}>
        <label>
          Message
          <textarea onChange={(event) => setDraft(event.target.value)} value={draft} />
        </label>
        <button className="button-filled" type="submit">
          Send
        </button>
      </form>
    </main>
  );
}
