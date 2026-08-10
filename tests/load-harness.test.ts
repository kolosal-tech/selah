import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function source(relativePath: string) {
  return readFile(path.join(rootDir, relativePath), "utf8");
}

describe("harnais de charge Selah", () => {
  it("exerce au moins 100 utilisateurs virtuels sans autoriser le distant par défaut", async () => {
    const config = JSON.parse(await source("load-test/config.json"));

    expect(config.thresholdsApproved).toBe(false);
    expect(config.load.vus).toBeGreaterThanOrEqual(100);
    expect(config.stress.steps).toContain(100);
    expect(config.spike.vus).toBeGreaterThanOrEqual(100);
  });

  it("vérifie des marqueurs réels et conserve un témoin statique", async () => {
    const config = JSON.parse(await source("load-test/config.json"));
    const login = await source("src/app/login/page.tsx");
    const discover = await source("src/app/decouvrir/page.tsx");
    const feed = await source("src/app/vertical-feed.tsx");
    const manifest = await source("public/manifest.json");
    const byTag = new Map<
      string,
      { tag: string; marker: string; requiresAuth?: boolean }
    >(
      config.pages.map((page: { tag: string; marker: string }) => [page.tag, page]),
    );

    expect(login).toContain(byTag.get("login")?.marker);
    expect(discover).toContain(byTag.get("discover")?.marker);
    expect(feed).toContain(byTag.get("feed-authenticated")?.marker);
    expect(byTag.get("feed-authenticated")?.requiresAuth).toBe(true);
    expect(manifest).toContain(byTag.get("manifest")?.marker);
    expect(config.pages.map((page: { role: string }) => page.role)).toEqual([
      "entry",
      "traffic",
      "traffic",
      "witness",
    ]);
  });

  it("refuse un tir distant tant que les seuils ne sont pas approuvés", async () => {
    const runner = await source("load-test/run.sh");
    const report = await source("load-test/report.mjs");
    const qaRunner = await source("load-test/run-qa.mjs");

    expect(runner).toContain("thresholdsApproved === true");
    expect(runner).toContain("Seuils non validés");
    expect(report).toContain("numericThreshold");
    expect(qaRunner).toContain("createServerClient");
    expect(qaRunner).toContain("AUTH_COOKIE");
    expect(qaRunner).not.toContain("console.log");
  });
});
