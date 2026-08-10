import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function source(relativePath: string) {
  return readFile(path.join(rootDir, relativePath), "utf8");
}

describe("garde-fous de performance et d'accessibilité", () => {
  it("réduit les vagues réseau du Fil sans changer les données affichées", async () => {
    const feed = await source("src/app/(app)/feed/page.tsx");
    const vertical = await source("src/app/vertical-feed.tsx");

    expect(feed).toContain("await Promise.all([");
    expect(vertical).toContain('.select("id, body, created_at, author_id, profiles(username)")');
    expect(vertical).toContain('.select("user_id, profiles(username)")');
  });

  it("instrumente la durée réelle d'ouverture des commentaires en développement", async () => {
    const vertical = await source("src/app/vertical-feed.tsx");
    expect(vertical).toContain("const startedAt = performance.now();");
    expect(vertical).toContain('[perf] ouverture commentaires');
  });

  it("garantit une cible tactile et un rendu différé sur le Mur de Prière", async () => {
    const nav = await source("src/app/nav-components.tsx");
    const prayer = await source("src/app/(app)/prayer/page-client.tsx");
    const css = await source("src/app/globals.css");
    expect(nav).toContain('href: "/prayer"');
    expect(nav).toContain("min-h-11 min-w-[52px]");
    expect(nav).toContain('aria-current={isActive ? "page" : undefined}');
    expect(prayer).toContain("prayer-card");
    expect(css).toContain("content-visibility: auto");
  });
});
