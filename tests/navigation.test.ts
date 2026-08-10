import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("navigation mobile", () => {
  it("force la navigation du lien Vidéos depuis les pages internes", async () => {
    const source = await readFile(path.join(rootDir, "src/app/nav-components.tsx"), "utf8");
    expect(source).toContain('href: "/", label: m.nav.videos');
    expect(source).toContain('data-nav-link={item.href}');
    expect(source).toContain('if (item.href === "/" && pathname !== "/")');
    expect(source).toContain('router.push("/")');
  });

  it("expose une cible tactile et un état de page accessibles", async () => {
    const source = await readFile(path.join(rootDir, "src/app/nav-components.tsx"), "utf8");
    expect(source).toContain("min-h-11 min-w-[52px]");
    expect(source).toContain('aria-current={isActive ? "page" : undefined}');
  });
});
