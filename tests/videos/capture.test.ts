import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("capture vidéo et audio", () => {
  it("demande caméra et micro, expose l'aperçu et protège le refus", async () => {
    const source = await readFile(path.join(rootDir, "src/app/(app)/videos/upload-form.tsx"), "utf8");
    expect(source).toContain("getUserMedia");
    expect(source).toContain("audio: true");
    expect(source).toContain("getAudioTracks()");
    expect(source).toContain("directRef.current.srcObject");
    expect(source).toContain("cameraInaccessible");
    expect(source).toContain("annulerCapture");
  });

  it("utilise un codec avec audio et un chronomètre écoulé", async () => {
    const source = await readFile(path.join(rootDir, "src/app/(app)/videos/upload-form.tsx"), "utf8");
    expect(source).toContain("vp8,opus");
    expect(source).toContain("rec.start(250)");
    expect(source).toContain("tempsEcoule");
    expect(source).toContain("audioActif");
  });

  it("sépare la capture mobile native du sélecteur de fichier vidéo", async () => {
    const source = await readFile(path.join(rootDir, "src/app/(app)/videos/upload-form.tsx"), "utf8");
    expect(source).toMatch(/accept="video\/\*"\s+capture="user"/);
    expect(source).toContain("cameraNativeRef");
    expect(source).toContain("fichierVideoRef");
  });

  it("ne demande le micro qu'après une action et fournit un aperçu audio pilotable", async () => {
    const source = await readFile(path.join(rootDir, "src/app/(app)/videos/upload-form.tsx"), "utf8");
    expect(source).toContain('ouvrirCapture("audio")');
    expect(source).toContain('video: kind === "video"');
    expect(source.match(/getUserMedia\(\{/g)).toHaveLength(1);
    expect(source).toMatch(/<audio[\s\S]*?controls/);
    expect(source).toContain("MAX_MEDIA_DURATION_SECONDS");
    expect(source).toContain("MAX_MEDIA_BYTES");
    expect(source).toContain("getTracks().forEach");
    expect(source).toContain("URL.revokeObjectURL");
  });

  it("conserve la reprise idempotente des envois", async () => {
    const [form, lot] = await Promise.all([
      readFile(path.join(rootDir, "src/app/(app)/videos/upload-form.tsx"), "utf8"),
      readFile(path.join(rootDir, "src/app/(app)/videos/depot-lot.tsx"), "utf8"),
    ]);
    expect(form).toContain("upsert: true");
    expect(lot).toContain("upsert: true");
    expect(lot).toContain("decrireFichierMedia");
    expect(lot).toContain("contentType: media.mimeType");
    expect(form).not.toContain("error.message");
    expect(lot).not.toContain("error.message");
  });
});
