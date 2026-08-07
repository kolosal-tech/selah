import { describe, expect, it } from "vitest";
import {
  isSabbathActive,
  sabbathEnd,
  sabbathRemainingLabel,
  SABBATH_HOURS,
} from "@/lib/sabbath";

const NOW = new Date("2026-08-07T12:00:00Z");

describe("sabbathEnd", () => {
  it("ajoute 24 h", () => {
    expect(sabbathEnd(NOW).toISOString()).toBe("2026-08-08T12:00:00.000Z");
    expect(SABBATH_HOURS).toBe(24);
  });
});

describe("isSabbathActive", () => {
  it("null/undefined → inactif", () => {
    expect(isSabbathActive(null, NOW)).toBe(false);
    expect(isSabbathActive(undefined, NOW)).toBe(false);
  });
  it("date future → actif", () => {
    expect(isSabbathActive("2026-08-08T00:00:00Z", NOW)).toBe(true);
  });
  it("date passée → inactif", () => {
    expect(isSabbathActive("2026-08-07T11:59:59Z", NOW)).toBe(false);
  });
  it("date invalide → inactif", () => {
    expect(isSabbathActive("pas-une-date", NOW)).toBe(false);
  });
});

describe("sabbathRemainingLabel", () => {
  it("heures + minutes", () => {
    expect(sabbathRemainingLabel("2026-08-07T14:30:00Z", NOW)).toBe("2 h 30 min");
  });
  it("minutes seules", () => {
    expect(sabbathRemainingLabel("2026-08-07T12:45:00Z", NOW)).toBe("45 min");
  });
  it("passé → terminé", () => {
    expect(sabbathRemainingLabel("2026-08-07T11:00:00Z", NOW)).toBe("terminé");
  });
});
