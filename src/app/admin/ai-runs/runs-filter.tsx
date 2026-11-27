"use client";

import { useRouter } from "next/navigation";
import { runsHref, type RunFilter } from "@/lib/ai-runs/log";

// #477: the Runs page's filter (the drawing's #reg-runs Filter panel): feature, user, model and
// "Stub runs only". Each change opens the page with the filter in its address, so a filtered view
// can be shared and reloaded.

type Option = { value: string; label: string };

export function RunsFilter({
  filter,
  features,
  users,
  models,
}: {
  filter: RunFilter;
  features: Option[];
  users: { id: string; label: string }[];
  models: string[];
}) {
  const router = useRouter();
  return (
    // Each change reads every control as it is now, so two quick changes never undo each other.
    <form
      aria-label="Filter runs"
      className="admin-filters admin-runs-filters"
      onChange={(event) => {
        const data = new FormData(event.currentTarget);
        const text = (name: string) => String(data.get(name) ?? "");
        const next: RunFilter = {
          feature: text("feature"),
          user: text("user"),
          model: text("model"),
          stubOnly: data.get("stub") === "1",
        };
        router.push(runsHref(next), { scroll: false });
      }}
      onSubmit={(event) => event.preventDefault()}
    >
      <label>
        Feature
        <select className="admin-text-field" defaultValue={filter.feature} name="feature">
          <option value="">All</option>
          {features.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        User
        <select className="admin-text-field" defaultValue={filter.user} name="user">
          <option value="">All</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Model
        <select className="admin-text-field" defaultValue={filter.model} name="model">
          <option value="">All</option>
          {models.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
      </label>
      <label className="admin-check">
        <input defaultChecked={filter.stubOnly} name="stub" type="checkbox" value="1" /> Stub runs
        only
      </label>
    </form>
  );
}
