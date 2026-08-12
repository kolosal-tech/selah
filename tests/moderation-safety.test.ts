import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { REPORT_CATEGORIES } from "@/lib/moderation";

const root = resolve(__dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("ADR-0012 moderation safety contract", () => {
  const migration = read("supabase/migrations/20260811200000_moderation_cases_appeals.sql");

  it("keeps the closed nine-category taxonomy and only reversible sanctions", () => {
    expect(REPORT_CATEGORIES).toHaveLength(9);
    expect(migration).toContain("enum ('warning', 'mentorship_restriction')");
    expect(migration).toContain("p_days not in (7, 30)");
    expect(migration).toMatch(/create type public\.moderation_sanction_kind as enum \('warning', 'mentorship_restriction'\);/);
  });

  it("uses public SECURITY INVOKER wrappers and private fixed-search-path implementations", () => {
    expect(migration).toMatch(/public\.issue_moderation_sanction[\s\S]*?security invoker/i);
    expect(migration).toMatch(/private\.issue_moderation_sanction[\s\S]*?security definer set search_path = pg_catalog, public, private/i);
    expect(migration).toContain("v_issuer = auth.uid()");
    expect(migration).toContain("issued_at + interval '30 days' >= now()");
    expect(migration).toContain("char_length(btrim(statement)) between 20 and 2000");
    expect(migration).toContain("char_length(btrim(decision_note)) between 20 and 2000");
    expect(migration).not.toContain("public.is_mentorship_restricted");
  });

  it("provides an accessible safety screen and a queue with explicit admin limits", () => {
    const safety = read("src/app/(app)/profile/safety/page.tsx");
    const appeal = read("src/app/(app)/profile/safety/appeal-button.tsx");
    const queue = read("src/app/(app)/moderation/page.tsx");
    expect(safety).toContain("Aucun bannissement automatique");
    expect(appeal).toContain('role="alert"');
    expect(queue).toContain("Dossier #");
    expect(queue).toContain("isAdmin={profile.role === \"admin\"}");
    expect(queue).toContain("Appels en attente");
    expect(appeal).toContain("minLength={20}");
  });
});
