import { describe, expect, it } from "vitest";
import {
  AUDIO_MIME_TYPES,
  decrireFichierMedia,
  extensionPourMime,
  isAudioStoragePath,
  MAX_MEDIA_BYTES,
  MAX_MEDIA_DURATION_SECONDS,
} from "@/lib/media-files";

describe("contrat des médias", () => {
  it("conserve les limites produit", () => {
    expect(MAX_MEDIA_BYTES).toBe(50 * 1024 * 1024);
    expect(MAX_MEDIA_DURATION_SECONDS).toBe(300);
    expect(AUDIO_MIME_TYPES).toEqual([
      "audio/mpeg",
      "audio/mp4",
      "audio/x-m4a",
      "audio/webm",
      "audio/ogg",
      "audio/wav",
    ]);
  });

  it.each([
    ["audio/mpeg", "mp3"],
    ["audio/mp4", "m4a"],
    ["audio/x-m4a", "m4a"],
    ["audio/webm;codecs=opus", "weba"],
    ["audio/ogg", "ogg"],
    ["audio/wav", "wav"],
  ])("associe %s à l'extension audio non ambiguë %s", (mimeType, extension) => {
    expect(extensionPourMime(mimeType, "audio")).toBe(extension);
  });

  it("utilise l'extension lorsque le navigateur omet le MIME", () => {
    expect(decrireFichierMedia({ name: "temoignage.M4A", type: "" }, "audio")).toEqual({
      kind: "audio",
      mimeType: "audio/mp4",
      extension: "m4a",
    });
  });

  it("n'accepte pas un fichier vidéo dans le choix audio", () => {
    expect(
      decrireFichierMedia({ name: "temoignage.mp4", type: "video/mp4" }, "audio"),
    ).toBeNull();
  });

  it.each([
    "personne/id.mp3",
    "personne/id.m4a?token=x",
    "personne/id.weba",
    "personne/id.ogg",
    "personne/id.wav#fragment",
  ])("détecte un post audio depuis son storage_path : %s", (storagePath) => {
    expect(isAudioStoragePath(storagePath)).toBe(true);
  });

  it.each(["personne/id.mp4", "personne/id.webm", "personne/id.mov"])(
    "laisse les extensions vidéo au lecteur vidéo : %s",
    (storagePath) => {
      expect(isAudioStoragePath(storagePath)).toBe(false);
    },
  );
});
