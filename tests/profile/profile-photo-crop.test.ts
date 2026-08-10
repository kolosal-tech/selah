import { describe, expect, it } from "vitest";
import { clamp, PROFILE_PHOTO_OUTPUT_SIZE, profilePhotoCrop } from "@/app/(app)/profile/profile-photo-crop";

describe("recadrage de photo de profil", () => {
  it("centre un portrait carré au zoom initial", () => {
    expect(profilePhotoCrop({ width: 600, height: 1000, zoom: 1, panX: 0, panY: 0 })).toEqual({
      x: 0,
      y: 200,
      width: 600,
      height: 600,
    });
  });

  it("repositionne le recadrage sans sortir de l'image", () => {
    expect(profilePhotoCrop({ width: 1200, height: 800, zoom: 2, panX: -100, panY: 100 })).toEqual({
      x: 0,
      y: 400,
      width: 400,
      height: 400,
    });
  });

  it("borne les valeurs de zoom et de déplacement fournies par l'interface", () => {
    const crop = profilePhotoCrop({ width: 1000, height: 600, zoom: 9, panX: -500, panY: 500 });
    expect(crop).toEqual({ x: 0, y: 400, width: 200, height: 200 });
    expect(clamp(4, 1, 3)).toBe(3);
  });

  it("produit une sortie bornée à 1024 px", () => {
    expect(PROFILE_PHOTO_OUTPUT_SIZE).toBe(1024);
  });
});
