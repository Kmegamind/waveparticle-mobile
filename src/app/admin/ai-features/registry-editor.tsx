"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useSyncExternalStore, useTransition } from "react";
import type { FeatureWriteResult } from "@/lib/ai-features/edit";
import {
  CATEGORIES,
  CATEGORY_LABEL,
  EXAMPLE_STATE_LABEL,
  EXAMPLE_STATES,
  type ExampleState,
  type RegistryCategory,
} from "@/lib/ai-features/registry-filter";
import { PageHead } from "../admin-ui";
import {
  changeCategoryAction,
  confirmExampleAction,
  saveRegistryFieldsAction,
  setExampleAction,
} from "./actions";
import { WRITE_PROBLEMS } from "./sections-editor";

// #475 (registry slice 3; FR-AIREG-7, AI-PAGE-EDIT, AI-EXAMPLE-CONFIRM; docs/decisions/0035): the
// registry editor of /admin/ai-features/<slug>/fields, built from the drawing's editors (AIF-7 for
// the form and its side panel, the status control of #reg-feature for the example state and the
// category) and Confirm on the feature page (#reg-feature). An admin or a writer saves the name
// and the six text fields and sets the example; the category is admin only (a writer sees it
// dimmed, "Admin only", as the status). Each save is checked again on the server and in the
// database, which keeps the history.

const noSubscription = () => () => {};
const useReady = () =>
  useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );

const failed = () => ({ ok: false, error: "failed" }) as const;
const problem = (result: FeatureWriteResult) => (result.ok ? "" : WRITE_PROBLEMS[result.error]);

/** The text fields of the form, in the order of the feature page, with their labels. */
const FIELDS = [
  { name: "where_used", label: "Where it appears", max: 300, line: true },
  { name: "requirement", label: "Requirement", max: 4000, line: false },
  { name: "output_format", label: "Output format and rules", max: 4000, line: false },
  { name: "design_rationale", label: "Design rationale", max: 4000, line: false },
  { name: "room_to_improve", label: "Room to improve", max: 4000, line: false },
  { name: "notes", label: "Notes", max: 4000, line: false },
] as const;

type FieldName = (typeof FIELDS)[number]["name"];
export type RegistryValues = { name: string } & Record<FieldName, string>;

type LastSave = { time: string; dateTime: string; person: string } | null;

export function RegistryFieldsEditor({
  slug,
  title,
  values,
  loadedAt,
  lastSave,
}: {
  slug: string;
  title: string;
  values: RegistryValues;
  /** fields_updated_at at page load; a newer save by someone else refuses this one. */
  loadedAt: string | null;
  lastSave: LastSave;
}) {
  const id = useId();
  const formId = `${id}-form`;
  const router = useRouter();
  const ready = useReady();
  const [draft, setDraft] = useState<RegistryValues>(values);
  const [savedAt, setSavedAt] = useState(loadedAt);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const off = !ready;

  const set = (name: keyof RegistryValues, value: string) =>
    setDraft((current) => ({ ...current, [name]: value }));

  return (
    <>
      <PageHead
        title={title}
        lede="The name and the text fields of this row. An admin or a writer edits them; every change is kept in the field history with who and when. Clear a box to leave it “Not written yet”."
        actions={
          <button className="button-filled" disabled={off || pending} form={formId} type="submit">
            Save
          </button>
        }
      />
      <div className="admin-editor">
        <form
          aria-label="Registry fields"
          className="admin-panel"
          id={formId}
          onSubmit={(event) => {
            event.preventDefault();
            setMessage("");
            startTransition(async () => {
              const result = await saveRegistryFieldsAction({
                slug,
                loadedAt: savedAt,
                ...draft,
              }).catch(failed);
              if (!result.ok) {
                setMessage(problem(result));
                return;
              }
              setSavedAt(result.savedAt ?? null);
              setMessage("Saved.");
              router.refresh();
            });
          }}
        >
          <div className="admin-form admin-registry-form">
            <label>
              Name
              <input
                className="admin-text-field"
                disabled={off}
                maxLength={120}
                onChange={(event) => set("name", event.target.value)}
                type="text"
                value={draft.name}
              />
            </label>
            {FIELDS.map((field) => (
              <label key={field.name}>
                {field.label}
                {field.line ? (
                  <input
                    className="admin-text-field"
                    disabled={off}
                    maxLength={field.max}
                    onChange={(event) => set(field.name, event.target.value)}
                    placeholder="Not written yet"
                    type="text"
                    value={draft[field.name]}
                  />
                ) : (
                  <textarea
                    className="admin-text-field"
                    disabled={off}
                    maxLength={field.max}
                    onChange={(event) => set(field.name, event.target.value)}
                    placeholder="Not written yet"
                    value={draft[field.name]}
                  />
                )}
              </label>
            ))}
          </div>
        </form>
        <section aria-labelledby={`${id}-last`} className="admin-panel admin-section">
          <h2 id={`${id}-last`}>Last save</h2>
          {lastSave ? (
            <table className="admin-table">
              <tbody>
                <tr>
                  <td className="admin-cell-note">
                    <time dateTime={lastSave.dateTime}>{lastSave.time}</time>
                  </td>
                  <td className="admin-history-person">{lastSave.person}</td>
                </tr>
              </tbody>
            </table>
          ) : (
            <p className="admin-note">Not saved in the admin yet. The text comes from the seed.</p>
          )}
        </section>
      </div>
      {message ? (
        <p className="admin-toast" role="status">
          {message}
        </p>
      ) : null}
    </>
  );
}

/** The example and its state. Any role (AI-EXAMPLE-CONFIRM). */
export function ExampleForm({
  slug,
  text,
  state,
  loadedAt,
}: {
  slug: string;
  text: string;
  state: ExampleState;
  /** example_set_at at page load. */
  loadedAt: string | null;
}) {
  const router = useRouter();
  const ready = useReady();
  const [draftText, setDraftText] = useState(text);
  const [chosen, setChosen] = useState<ExampleState>(state);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const off = !ready;

  return (
    <form
      aria-label="Example"
      className="admin-form"
      onSubmit={(event) => {
        event.preventDefault();
        setMessage("");
        startTransition(async () => {
          const result = await setExampleAction({
            slug,
            loadedAt,
            text: draftText,
            state: chosen,
          }).catch(failed);
          if (!result.ok) {
            setMessage(problem(result));
            return;
          }
          setMessage("Example saved.");
          router.refresh();
        });
      }}
    >
      <div aria-label="Example state" className="admin-seg" role="group">
        {EXAMPLE_STATES.map((value) => (
          <button
            aria-pressed={chosen === value}
            className="button-gray"
            disabled={off}
            key={value}
            onClick={() => setChosen(value)}
            type="button"
          >
            {EXAMPLE_STATE_LABEL[value]}
          </button>
        ))}
      </div>
      <label>
        Example text
        <textarea
          className="admin-text-field admin-registry-example"
          disabled={off}
          maxLength={8000}
          onChange={(event) => setDraftText(event.target.value)}
          placeholder="Not written yet"
          value={draftText}
        />
      </label>
      <div>
        <button className="button-filled" disabled={off || pending} type="submit">
          Save example
        </button>
      </div>
      {message ? (
        <p className="admin-toast" role="status">
          {message}
        </p>
      ) : null}
    </form>
  );
}

/** The category: admin only. A writer sees it disabled, in a dimmed panel. */
export function CategoryForm({
  slug,
  category,
  readOnly,
}: {
  slug: string;
  category: RegistryCategory;
  readOnly: boolean;
}) {
  const router = useRouter();
  const ready = useReady();
  const [chosen, setChosen] = useState<RegistryCategory>(category);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const off = readOnly || !ready;

  return (
    <form
      aria-label="Category"
      className="admin-form"
      onSubmit={(event) => {
        event.preventDefault();
        setMessage("");
        startTransition(async () => {
          const result = await changeCategoryAction(slug, chosen).catch(failed);
          if (!result.ok) {
            setMessage(problem(result));
            return;
          }
          setMessage("Category saved.");
          router.refresh();
        });
      }}
    >
      <div aria-label="Category" className="admin-seg" role="group">
        {CATEGORIES.map((value) => (
          <button
            aria-pressed={chosen === value}
            className="button-gray"
            disabled={off}
            key={value}
            onClick={() => setChosen(value)}
            type="button"
          >
            {CATEGORY_LABEL[value]}
          </button>
        ))}
      </div>
      <div>
        <button className="button-filled" disabled={off || pending} type="submit">
          Save category
        </button>
      </div>
      {message ? (
        <p className="admin-toast" role="status">
          {message}
        </p>
      ) : null}
    </form>
  );
}

/** Confirm on the feature page: the candidate example becomes confirmed with one action. */
export function ConfirmExample({ slug, loadedAt }: { slug: string; loadedAt: string | null }) {
  const router = useRouter();
  const ready = useReady();
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <>
      <button
        className="button-gray button-small"
        disabled={!ready || pending}
        onClick={() => {
          setMessage("");
          startTransition(async () => {
            const result = await confirmExampleAction(slug, loadedAt).catch(failed);
            if (!result.ok) {
              setMessage(problem(result));
              return;
            }
            setMessage("Example confirmed.");
            router.refresh();
          });
        }}
        type="button"
      >
        Confirm
      </button>
      {message ? (
        <span className="admin-toast" role="status">
          {message}
        </span>
      ) : null}
    </>
  );
}
