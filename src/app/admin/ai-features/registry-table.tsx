"use client";

import Link from "next/link";
import { useState } from "react";
import {
  CATEGORIES,
  CATEGORY_LABEL,
  EXAMPLE_STATES,
  filterRegistry,
  NO_FILTER,
  NOT_WRITTEN_YET,
  type RegistryCategory,
  type RegistryFilter,
  type RegistryRow,
  type RegistryStatus,
} from "@/lib/ai-features/registry-filter";
import { ExamplePill } from "./registry-ui";

// #474 (FR-AIREG-1): the registry table of docs/design/prototype/admin-ai-features.html
// (#reg-registry): every AI feature in one table, filtered by category and status, searched, and
// sorted by ID. The rows are read on the server and come in as props; only the filters run here.
// The table scrolls sideways inside its panel, with ID and Name kept in view.

export type StatusWord = { value: RegistryStatus; label: string };

function StatusPill({ status, statuses }: { status: RegistryStatus; statuses: StatusWord[] }) {
  return (
    <span className={`admin-pill admin-pill-ai-${status}`}>
      {statuses.find((item) => item.value === status)?.label ?? status}
    </span>
  );
}

export function RegistryTable({
  rows,
  statuses,
  admin,
  unreadable,
}: {
  rows: RegistryRow[];
  statuses: StatusWord[];
  /** An admin sees Change beside the status of a row whose status it can change here. */
  admin: boolean;
  /** The registry could not be read: no row, and the empty row says there is nothing to show. */
  unreadable: boolean;
}) {
  const [filter, setFilter] = useState<RegistryFilter>(NO_FILTER);
  const shown = filterRegistry(rows, filter);
  const empty = unreadable
    ? "Nothing to show"
    : rows.length === 0
      ? "No features yet"
      : "No feature matches these filters";

  return (
    <>
      <div className="admin-filters">
        <label>
          Category
          <select
            className="admin-text-field"
            onChange={(event) =>
              setFilter({ ...filter, category: event.target.value as RegistryCategory | "" })
            }
            value={filter.category}
          >
            <option value="">All</option>
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {CATEGORY_LABEL[category]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select
            className="admin-text-field"
            onChange={(event) =>
              setFilter({ ...filter, status: event.target.value as RegistryStatus | "" })
            }
            value={filter.status}
          >
            <option value="">All</option>
            {statuses.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Search
          <input
            className="admin-text-field"
            onChange={(event) => setFilter({ ...filter, query: event.target.value })}
            placeholder="ID, name or any text"
            type="text"
            value={filter.query}
          />
        </label>
        <button
          aria-pressed={filter.descending}
          className="button-gray"
          onClick={() => setFilter({ ...filter, descending: !filter.descending })}
          type="button"
        >
          Sort by ID {filter.descending ? "↓" : "↑"}
        </button>
      </div>
      <div className="admin-panel">
        <div className="admin-scroll admin-reg-scroll">
          <table aria-label="AI features" className="admin-table admin-reg">
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Name</th>
                <th scope="col">Category</th>
                <th scope="col">Where it appears</th>
                <th scope="col">Requirement</th>
                <th scope="col">Prompt</th>
                <th scope="col">Status</th>
                <th scope="col">Example</th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <p className="admin-empty">{empty}</p>
                  </td>
                </tr>
              ) : null}
              {shown.map((row) => {
                const href = `/admin/ai-features/${row.slug}`;
                return (
                  <tr key={row.slug}>
                    <td>
                      <span className="admin-chip">{row.featureId}</span>
                    </td>
                    <td>
                      <b>
                        <Link href={href}>{row.name}</Link>
                      </b>
                    </td>
                    <td>{CATEGORY_LABEL[row.category] ?? row.category}</td>
                    <td className="admin-cell-note">{row.where || NOT_WRITTEN_YET}</td>
                    <td className="admin-reg-wide">{row.requirement || NOT_WRITTEN_YET}</td>
                    <td>
                      {row.prompts.length === 0 ? (
                        <span className="admin-cell-note">{NOT_WRITTEN_YET}</span>
                      ) : (
                        row.prompts.map((prompt) => (
                          <span className="admin-reg-prompt" key={prompt.key}>
                            <span className="admin-chip">
                              {prompt.key}
                              {prompt.published === null ? "" : ` v${prompt.published}`}
                            </span>
                            {prompt.draft === null ? null : (
                              <>
                                {" "}
                                <span className="admin-pill admin-pill-draft">
                                  Draft v{prompt.draft}
                                </span>
                              </>
                            )}{" "}
                          </span>
                        ))
                      )}
                      <Link
                        aria-label={`View the prompt of ${row.featureId}`}
                        href={`${href}#prompt`}
                      >
                        view
                      </Link>
                    </td>
                    <td>
                      <StatusPill status={row.status} statuses={statuses} />
                      {admin ? (
                        <>
                          {" "}
                          <Link
                            aria-label={`Change the status of ${row.featureId}`}
                            className="button-gray button-small"
                            href={`${href}#status`}
                          >
                            Change
                          </Link>
                        </>
                      ) : null}
                    </td>
                    <td>
                      <ExamplePill state={row.exampleState} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div aria-label="Pills" className="admin-legend" role="note">
        <span>
          Example:{" "}
          {EXAMPLE_STATES.map((state) => (
            <ExamplePill key={state} state={state} />
          ))}
        </span>
        <span>
          Status:{" "}
          {statuses.map((status) => (
            <StatusPill key={status.value} status={status.value} statuses={statuses} />
          ))}
        </span>
        <span>
          {admin
            ? "Change opens the status control on the feature page (admin only)."
            : "Status is admin only: a writer sees no Change button."}
        </span>
      </div>
    </>
  );
}
