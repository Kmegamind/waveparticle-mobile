"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { helpLineStorage, writeHelpLineCopy } from "@/lib/safety/help-lines";
import { setHelpCountryAction } from "../actions";

/**
 * ME-REGION (#118): a search box, "No country", then every country by its English name. A tap
 * saves the choice to the account, copies it to the phone and returns to Me. A failed save keeps
 * the old choice and offers Retry (FLOW ME-REGION).
 */
export function CountryPicker({
  chosen,
  countries,
}: {
  chosen: string | null;
  countries: { code: string; name: string }[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [failed, setFailed] = useState<string | null | undefined>(undefined);
  const [pending, startTransition] = useTransition();
  const needle = query.trim().toLowerCase();
  const shown = needle
    ? countries.filter((country) => country.name.toLowerCase().includes(needle))
    : countries;

  function choose(country: string | null) {
    setFailed(undefined);
    startTransition(async () => {
      const result = await setHelpCountryAction({ country }).catch(() => ({
        status: "failed" as const,
      }));
      if (result.status !== "ok") return setFailed(country);
      if (result.copy) writeHelpLineCopy(helpLineStorage(), result.copy);
      setQuery("");
      router.push("/me");
      router.refresh();
    });
  }

  const row = (code: string | null, label: string) => {
    const selected = (chosen ?? null) === code;
    return (
      <li key={code ?? "none"}>
        <button
          aria-pressed={selected}
          className="me-row me-row-button"
          disabled={pending}
          onClick={() => choose(code)}
          type="button"
        >
          <span>{label}</span>
          <span aria-hidden="true" className="me-caret">
            {selected ? "✓" : ""}
          </span>
        </button>
      </li>
    );
  };

  return (
    <>
      <label className="focus-label" htmlFor="me-country-search">
        Search countries
      </label>
      <input
        autoComplete="off"
        className="me-field"
        id="me-country-search"
        onChange={(event) => setQuery(event.target.value)}
        type="search"
        value={query}
      />
      {failed !== undefined ? (
        <p className="me-country-error" role="alert">
          Couldn&rsquo;t save. Try again.{" "}
          <button className="me-text-button" onClick={() => choose(failed)} type="button">
            Retry
          </button>
        </p>
      ) : null}
      <ul aria-label="Countries" className="me-country-list">
        {row(null, "No country")}
        {shown.map((country) => row(country.code, country.name))}
      </ul>
      {shown.length === 0 ? <p className="me-quiet">No country matches.</p> : null}
    </>
  );
}
