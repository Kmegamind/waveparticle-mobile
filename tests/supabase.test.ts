import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";

describe("readSupabaseEnv", () => {
  it("returns the url and the public key", () => {
    const env = readSupabaseEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-key",
    });
    expect(env).toEqual({ url: "https://example.supabase.co", anonKey: "public-key" });
  });

  it("explains what is missing", () => {
    expect(() => readSupabaseEnv({})).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });
});

describe("a request without a session", () => {
  it("is treated as signed out", async () => {
    const client = createSupabaseClient(
      { getAll: () => [], setAll: () => {} },
      { url: "http://127.0.0.1:9", anonKey: "public-key" },
    );
    expect(await getCurrentUser(client)).toBeNull();
  });
});

describe("secrets", () => {
  it("never mention a service-role key in the source code", () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(name)) files.push(full);
      }
    };
    walk(path.join(__dirname, "..", "src"));
    const offenders = files.filter((f) => /service[_-]?role/i.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
