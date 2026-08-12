import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { classifyUserAgent } from "@/lib/account-session";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("cycle de vie du compte", () => {
  it("réduit le user-agent à des catégories sans conserver sa chaîne brute", () => {
    expect(classifyUserAgent("Mozilla/5.0 (iPhone) Version/17.0 Mobile Safari/604.1")).toEqual({ browserFamily: "safari", deviceType: "mobile" });
    expect(classifyUserAgent("Mozilla/5.0 Chrome/120.0")).toEqual({ browserFamily: "chrome", deviceType: "desktop" });
    expect(classifyUserAgent(null)).toEqual({ browserFamily: "other", deviceType: "other" });
  });

  it("verrouille le Cron, purge Storage avant Auth et garde l'export privé", async () => {
    const route = await readFile(path.join(root, "src/app/api/cron/account-deletions/route.ts"), "utf8");
    const exportRoute = await readFile(path.join(root, "src/app/api/account/export/route.ts"), "utf8");
    const actions = await readFile(path.join(root, "src/app/actions.ts"), "utf8");
    const config = await readFile(path.join(root, "vercel.json"), "utf8");
    expect(route).toContain("CRON_SECRET");
    expect(route.indexOf("removeOwnedObjects")).toBeLessThan(route.indexOf("auth.admin.deleteUser"));
    expect(route).toContain("already_deleted");
    expect(route).not.toContain("console.");
    expect(exportRoute).toContain('"Cache-Control": "no-store, private"');
    expect(actions).toContain('signOut({ scope: "local" })');
    expect(config).toContain("/api/cron/account-deletions");
  });
});
