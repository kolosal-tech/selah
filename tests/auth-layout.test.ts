import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("formulaires d'authentification mobiles", () => {
  it("s'adapte à la hauteur dynamique du clavier sans centrer le contenu mobile", async () => {
    const login = await readFile(path.join(rootDir, "src/app/login/page.tsx"), "utf8");
    const signup = await readFile(path.join(rootDir, "src/app/signup/page.tsx"), "utf8");
    for (const source of [login, signup]) {
      expect(source).toContain("min-h-[100dvh]");
      expect(source).toContain("justify-start");
      expect(source).toContain("sm:justify-center");
      expect(source).toContain("overflow-y-auto");
      expect(source).toContain("env(safe-area-inset-top)");
      expect(source).toContain("env(safe-area-inset-bottom)");
    }
  });

  it("conserve des cibles tactiles et des contrôles accessibles", async () => {
    const login = await readFile(path.join(rootDir, "src/app/login/page.tsx"), "utf8");
    const signup = await readFile(path.join(rootDir, "src/app/signup/page.tsx"), "utf8");
    expect(login).toContain('htmlFor="login-email"');
    expect(login).toContain("min-h-11");
    expect(signup).toContain('name="email"');
    expect(signup).toContain("min-h-11");
  });
});
