import { describe, expect, it } from "vitest";
import { defiEnCours, jourDuDefi, progression } from "@/lib/challenge";

const DEFI = { days: 21, starts_on: "2026-08-01" };

describe("jourDuDefi", () => {
  it("premier jour = 1", () => {
    expect(jourDuDefi(DEFI, "2026-08-01")).toBe(1);
  });
  it("septième jour = 7", () => {
    expect(jourDuDefi(DEFI, "2026-08-07")).toBe(7);
  });
  it("avant le départ = 0", () => {
    expect(jourDuDefi(DEFI, "2026-07-31")).toBe(0);
  });
  it("après la fin, plafonné à la durée", () => {
    expect(jourDuDefi(DEFI, "2026-09-30")).toBe(21);
  });
});

describe("defiEnCours", () => {
  it("dernier jour inclus", () => {
    expect(defiEnCours(DEFI, "2026-08-21")).toBe(true);
  });
  it("lendemain de la fin exclu", () => {
    expect(defiEnCours(DEFI, "2026-08-22")).toBe(false);
  });
  it("avant le départ exclu", () => {
    expect(defiEnCours(DEFI, "2026-07-31")).toBe(false);
  });
});

describe("progression", () => {
  it("arrondit au pourcentage entier", () => {
    expect(progression(7, 21)).toBe(33);
  });
  it("total nul → 0, pas de division par zéro", () => {
    expect(progression(3, 0)).toBe(0);
  });
  it("borné à 100 même si dépassement", () => {
    expect(progression(30, 21)).toBe(100);
  });
  it("aucun jour fait → 0", () => {
    expect(progression(0, 21)).toBe(0);
  });
});
