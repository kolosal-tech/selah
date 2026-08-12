import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isEnabled } from "@/lib/flags";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function source(relativePath: string) {
  return readFile(path.join(rootDir, relativePath), "utf8");
}

describe("ADR-0011 — attestation et mentorat", () => {
  it("ferme le mentorat par défaut", () => {
    expect(isEnabled("mentorship")).toBe(false);
  });

  it("exige une attestation explicite à l'inscription sans collecter de date ni document", async () => {
    const signup = await source("src/app/signup/page.tsx");
    const actions = await source("src/app/actions.ts");
    expect(signup).toContain('name="age_attestation"');
    expect(signup).toContain('type="checkbox"');
    expect(signup).not.toMatch(/date[_ -]?(?:de )?naissance|birth[_ -]?date|document d'identité/i);
    expect(actions).toContain('formData.get("age_attestation")');
    expect(actions).toContain("age_attested: true");
  });

  it("retire le mentorat de la navigation tant que le flag ou l'attestation manque", async () => {
    const layout = await source("src/app/(app)/layout.tsx");
    const navigation = await source("src/app/nav-components.tsx");
    expect(layout).toContain('isEnabled("mentorship") && Boolean(attestation)');
    expect(layout).toContain("mentorshipVisible={mentorshipVisible}");
    expect(navigation).toContain('item.href !== "/mentorship"');
  });

  it("porte l'attestation dans une table privée et sécurise les deux parties par RLS", async () => {
    const migration = await source("supabase/migrations/20260811220000_age_attestation_mentorat.sql");
    const fixture = await source("tests/age-mentorship-rls.sql");
    expect(migration).toContain("create table public.age_attestations");
    expect(migration).toContain("create or replace function public.attest_age_18() returns boolean");
    expect(migration).toContain("private.is_mentorship_eligible(mentor_id)");
    expect(migration).toContain("private.is_mentorship_eligible(mentee_id)");
    expect(migration).not.toMatch(/date_of_birth|birth_date|date_naissance|identity_document/i);
    expect(fixture).toContain("offre non attestée acceptée");
    expect(fixture).toContain("attestation adversaire acceptée");
    expect(fixture).toContain("statut d''attestation tiers lisible");
  });
});
