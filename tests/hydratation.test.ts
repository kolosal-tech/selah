import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function source(relatif: string) {
  return readFile(path.join(racine, relatif), "utf8");
}

/** Parcourt récursivement `src/` et rend les chemins relatifs des .ts/.tsx. */
async function fichiersSource(sousDossier = "src"): Promise<string[]> {
  const entrees = await readdir(path.join(racine, sousDossier), {
    withFileTypes: true,
  });
  const chemins: string[] = [];
  for (const entree of entrees) {
    const relatif = `${sousDossier}/${entree.name}`;
    if (entree.isDirectory()) chemins.push(...(await fichiersSource(relatif)));
    else if (/\.tsx?$/.test(entree.name)) chemins.push(relatif);
  }
  return chemins;
}

describe("cohérence serveur/client du rendu", () => {
  it("ne calcule aucun libellé Intl dans un composant client", async () => {
    // `Intl.DisplayNames`, `localeCompare` et les formateurs de date/nombre
    // s'appuient sur la table ICU du moteur. Celle de Node ne coïncide pas avec
    // celle de WebKit : un libellé calculé des deux côtés diverge, et React
    // refuse d'hydrater l'arbre entier (erreur #418). Le défaut est invisible
    // sur Chromium, dont l'ICU s'aligne avec celle de Node — d'où ce test.
    // Seule exemption : une donnée qui n'existe pas au rendu serveur ne peut
    // pas diverger de lui. Les fichiers choisis dans un `<input type="file">`
    // sont dans ce cas — ils naissent d'un geste utilisateur.
    const exemptions = new Set(["src/app/(app)/videos/depot-lot.tsx"]);

    const coupables: string[] = [];
    for (const chemin of await fichiersSource()) {
      if (exemptions.has(chemin)) continue;
      const contenu = await source(chemin);
      if (!contenu.startsWith('"use client"')) continue;
      if (/new Intl\.|\.localeCompare\(/.test(contenu)) coupables.push(chemin);
    }
    expect(coupables).toEqual([]);
  });

  it("ordonne les pairs WebRTC par octets, pas par collation", async () => {
    const audio = await source("src/app/(app)/rooms/[id]/room-audio.tsx");
    // La collation dépend du moteur : deux pairs sur des navigateurs
    // différents pourraient se croire tous deux initiateurs, ou aucun, et la
    // salle resterait muette sans erreur visible.
    expect(audio).toContain("if (userId >= peerId) return;");
    expect(audio).not.toContain("userId.localeCompare(peerId)");
  });

  it("rend la liste des pays côté serveur", async () => {
    const champ = await source("src/app/signup/champ-pays.tsx");
    // Régression du 14 août 2026 : ce composant était client et faisait
    // échouer l'hydratation de /signup sur Safari.
    expect(champ).not.toContain('"use client"');
    expect(champ).toContain("new Intl.DisplayNames");
    expect(champ).toContain("export async function ChampPays");
  });

  it("exerce Safari dans la couverture navigateur", async () => {
    const config = await source("playwright.config.ts");
    // WebKit est le seul moteur disponible sur iOS : un parcours qui n'y est
    // jamais joué est non testé pour une part réelle du public.
    expect(config).toContain('name: "webkit"');
    expect(config).toContain('devices["Desktop Safari"]');
  });
});
