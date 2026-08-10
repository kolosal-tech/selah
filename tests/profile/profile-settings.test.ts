import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("Profil et paramètres", () => {
  it("rend l'accès profil tactile et la suppression explicitement confirmée", async () => {
    const layout = await readFile(path.join(rootDir, "src/app/(app)/layout.tsx"), "utf8");
    const photo = await readFile(path.join(rootDir, "src/app/(app)/profile/profile-photo-form.tsx"), "utf8");
    const page = await readFile(path.join(rootDir, "src/app/(app)/profile/page.tsx"), "utf8");
    const actions = await readFile(path.join(rootDir, "src/app/actions.ts"), "utf8");
    expect(layout).toContain('href="/profile"');
    expect(layout).toContain("min-h-11 min-w-11");
    expect(photo).toContain("window.confirm");
    expect(photo).toContain("removeProfileAvatar");
    expect(page).toContain("SelecteurLangue");
    expect(page).toContain("AppPreferences");
    expect(actions).toContain("removeProfileAvatar");
    expect(photo).toContain("URL.revokeObjectURL");
  });

  it("met à jour le profil avant de nettoyer l'ancien avatar, sans rollback du nouveau en cas d'échec DB", async () => {
    const actions = await readFile(path.join(rootDir, "src/app/actions.ts"), "utf8");
    const photo = await readFile(path.join(rootDir, "src/app/(app)/profile/profile-photo-form.tsx"), "utf8");
    const updateIndex = actions.indexOf('.update({ avatar_path: chemin })');
    const cleanupIndex = actions.indexOf('.remove([ancienChemin])');
    expect(updateIndex).toBeGreaterThan(-1);
    expect(cleanupIndex).toBeGreaterThan(updateIndex);
    expect(actions).toContain('return { ok: false as const, reason: "profil" as const }');
    expect(photo).not.toContain('remove([cheminProprietaire])');
  });
});
