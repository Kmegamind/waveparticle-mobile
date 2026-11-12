"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { backToStep, submitStepDraft } from "@/lib/safety/crisis";
import { CrisisPage } from "./crisis-page";

const noSubscription = () => () => {};

export function StepSafetyGate() {
  const [screen, setScreen] = useState<"step" | "crisis">("step");
  const message = useRef<HTMLTextAreaElement>(null);
  // False in the server HTML and during hydration, true once React has hydrated the form.
  // Send stays disabled until then, so the browser never does a native submit (#204).
  const ready = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // The field is uncontrolled, so text typed before hydration is read from the field itself.
    const next = submitStepDraft(message.current?.value ?? "");
    setScreen(next.screen);
  }

  if (screen === "crisis") {
    // Back to my Step mounts a new, empty field.
    return <CrisisPage onBack={() => setScreen(backToStep().screen)} />;
  }

  return (
    <main className="app-screen step-screen">
      <h1>Step</h1>
      <form data-ready={ready ? "true" : "false"} onSubmit={onSubmit}>
        <label>
          Message
          {/* No name attribute: the text is never part of a native form submission. */}
          <textarea defaultValue="" ref={message} />
        </label>
        <button
          aria-describedby={ready ? undefined : "send-not-ready"}
          className="button-filled"
          disabled={!ready}
          type="submit"
        >
          Send
        </button>
        {ready ? null : (
          <p className="step-note" id="send-not-ready">
            Send is ready once the page has loaded.
          </p>
        )}
      </form>
    </main>
  );
}
