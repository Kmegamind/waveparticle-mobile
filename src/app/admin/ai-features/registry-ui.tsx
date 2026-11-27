import {
  EXAMPLE_STATE_LABEL,
  promptParts,
  type ExampleState,
} from "@/lib/ai-features/registry-filter";

// #474: small pieces of the registry screens (docs/design/prototype/admin-ai-features.html,
// #reg-registry and #reg-feature). They import no server code, so the registry table, which runs
// in the browser for its filters, uses them too.

/** The example state (AI-EXAMPLE-CONFIRM) as the drawing's pill: None, Candidate, Confirmed. */
export function ExamplePill({ state }: { state: ExampleState }) {
  return (
    <span className={`admin-pill admin-pill-example-${state}`}>{EXAMPLE_STATE_LABEL[state]}</span>
  );
}

/** "Viewing as admin" or "Viewing as writer", in the header action row as the drawing. */
export function RolePill({ role }: { role: "admin" | "writer" }) {
  return role === "admin" ? (
    <span className="admin-pill admin-pill-role-admin">Viewing as admin</span>
  ) : (
    <span className="admin-pill admin-pill-role-writer">Viewing as writer</span>
  );
}

/** FR-AIREG-2: a prompt text with its `{{variables}}` marked; the text itself is unchanged. */
export function PromptBody({ text }: { text: string }) {
  return (
    <>
      {promptParts(text).map((part, index) =>
        part.variable ? (
          <span className="admin-var" key={index}>
            {part.text}
          </span>
        ) : (
          part.text
        ),
      )}
    </>
  );
}
