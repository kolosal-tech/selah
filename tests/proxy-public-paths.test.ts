import { describe, expect, it } from "vitest";
import { isPublicPath } from "@/lib/public-paths";

describe("chemins publics du proxy", () => {
  it.each([
    "/decouvrir",
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/auth/callback",
    "/manifest.json",
    "/sw.js",
    "/hors-ligne",
    "/api/translate",
  ])("laisse %s public", (pathname) => {
    expect(isPublicPath(pathname)).toBe(true);
  });

  it.each(["/", "/videos", "/profile", "/rooms/123", "/api"])(
    "protège %s",
    (pathname) => {
      expect(isPublicPath(pathname)).toBe(false);
    },
  );
});
