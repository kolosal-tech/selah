import { describe, expect, it } from "vitest";
import { touchStreak, isoDay } from "@/lib/streak";

describe("touchStreak", () => {
  it("première action → streak 1", () => {
    expect(touchStreak({ days: 0, lastDay: null }, "2026-08-07")).toEqual({
      days: 1,
      lastDay: "2026-08-07",
    });
  });
  it("même jour → inchangé", () => {
    const s = { days: 5, lastDay: "2026-08-07" };
    expect(touchStreak(s, "2026-08-07")).toBe(s);
  });
  it("jour suivant → +1", () => {
    expect(touchStreak({ days: 5, lastDay: "2026-08-06" }, "2026-08-07")).toEqual({
      days: 6,
      lastDay: "2026-08-07",
    });
  });
  it("jour manqué → repart à 1", () => {
    expect(touchStreak({ days: 5, lastDay: "2026-08-04" }, "2026-08-07")).toEqual({
      days: 1,
      lastDay: "2026-08-07",
    });
  });
  it("passage de mois", () => {
    expect(touchStreak({ days: 2, lastDay: "2026-07-31" }, "2026-08-01")).toEqual({
      days: 3,
      lastDay: "2026-08-01",
    });
  });
});

describe("isoDay", () => {
  it("format YYYY-MM-DD", () => {
    expect(isoDay(new Date("2026-08-07T23:59:59Z"))).toBe("2026-08-07");
  });
});
