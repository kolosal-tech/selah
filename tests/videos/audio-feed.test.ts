import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("posts audio du feed", () => {
  it("infère le média depuis storage_path et rend un lecteur pilotable", async () => {
    const source = await readFile(path.join(rootDir, "src/app/vertical-feed.tsx"), "utf8");
    expect(source).toContain("isAudioStoragePath(v.storage_path)");
    expect(source).toMatch(/<audio[\s\S]*?controls/);
    expect(source).toContain("mediaRefs.current[i] = el");
  });

  it("réagit immédiatement aux préférences de son partagées", async () => {
    const source = await readFile(path.join(rootDir, "src/app/vertical-feed.tsx"), "utf8");
    expect(source).toContain("subscribeAppPreferences");
    expect(source).toContain("readAppPreferences().feedSound");
    expect(source).toContain('updateAppPreference("feedSound"');
  });
});
