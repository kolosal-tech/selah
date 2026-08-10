import { describe, expect, it } from "vitest";
import { feedCursorFilter } from "@/lib/feed-cursor";

const cursor = {
  id: "00000000-0000-4000-8000-000000000001",
  rang_auteur: 2,
  score: 12.5,
};

describe("feedCursorFilter", () => {
  it("exprime le tri complet du feed sans offset", () => {
    expect(feedCursorFilter(cursor)).toBe(
      "rang_auteur.gt.2,and(rang_auteur.eq.2,score.lt.12.5),and(rang_auteur.eq.2,score.eq.12.5,id.gt.00000000-0000-4000-8000-000000000001)",
    );
  });

  it("refuse un curseur incomplet ou non fiable", () => {
    expect(feedCursorFilter(undefined)).toBeNull();
    expect(feedCursorFilter({ ...cursor, id: "invalide" })).toBeNull();
    expect(feedCursorFilter({ ...cursor, score: Number.NaN })).toBeNull();
  });
});
