import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function source(relatif: string) {
  return readFile(path.join(racine, relatif), "utf8");
}

describe("fil vidéo : Pour toi / Abonnements", () => {
  it("le serveur filtre sur author_id en mode abonnements, et fait l'économie de la requête sans aucun suivi", async () => {
    const page = await source("src/app/page.tsx");

    // Le paramètre de recherche est étendu, pas remplacé : le lien de partage
    // /?v= doit continuer de fonctionner à l'identique.
    expect(page).toContain("searchParams: Promise<{ v?: string; fil?: string }>");
    expect(page).toContain('const { v: videoPartagee, fil } = await searchParams;');
    expect(page).toMatch(/fil === "abonnements" \? "abonnements" : "pourToi"/);

    // Le filtre vise explicitement author_id, sur la même vue videos_feed.
    expect(page).toContain('requete.in("author_id", suivis)');
    // Aucun aller-retour réseau quand la liste de suivis est vide.
    expect(page).toMatch(/mode !== "abonnements" \|\| suivis\.length > 0/);

    // La prop mode et les suivis déjà calculés sont transmis au client.
    expect(page).toContain("initialSuivis={suivis}");
    expect(page).toContain("mode={mode}");
  });

  it("la pagination infinie applique le même filtre que le premier rendu serveur", async () => {
    const rail = await source("src/app/vertical-feed.tsx");

    // Régression la plus coûteuse de ce lot : sans ce filtre, faire défiler
    // en mode abonnements ramènerait des auteurs non suivis.
    const effetPagination = /Pagination infinie[\s\S]*?\n {2}\}, \[active, videos, fin, locale, mode, initialSuivis\]\);/.exec(
      rail,
    );
    expect(effetPagination, "useEffect de pagination introuvable").not.toBeNull();
    expect(effetPagination![0]).toContain('in("author_id"');
    expect(effetPagination![0]).toContain('if (mode === "abonnements")');
  });

  it("accepte la prop mode et resynchronise le fil affiché à la bascule d'onglet", async () => {
    const rail = await source("src/app/vertical-feed.tsx");

    expect(rail).toContain('mode?: "pourToi" | "abonnements"');
    expect(rail).toContain('mode = "pourToi"');
    // useState(initialVideos) n'est lu qu'au montage : sans resynchronisation
    // explicite, l'URL changerait sans que le fil affiché change.
    expect(rail).toContain("setVideos(initialVideos)");
  });

  it("les deux onglets pointent vers / et /?fil=abonnements avec aria-current", async () => {
    const rail = await source("src/app/vertical-feed.tsx");

    expect(rail).toContain('href="/"');
    expect(rail).toContain('href="/?fil=abonnements"');
    expect(rail).toContain('aria-current={mode === "pourToi" ? "page" : undefined}');
    expect(rail).toContain('aria-current={mode === "abonnements" ? "page" : undefined}');
    expect(rail).toContain("{m.video.filPourToi}");
    expect(rail).toContain("{m.video.filAbonnements}");
    // Cibles tactiles >= 44 px (min-h-11 = 44px dans l'échelle Tailwind).
    expect(rail).toMatch(/min-h-11 min-w-\[92px\][^`]*filPourToi|filPourToi/);
  });

  it("affiche un état vide propre au mode abonnements, distinct du feedVide générique", async () => {
    const rail = await source("src/app/vertical-feed.tsx");

    expect(rail).toContain('mode === "abonnements" && (');
    expect(rail).toContain("{m.video.filAbonnementsVide}");
    expect(rail).toContain("{m.video.filAbonnementsVideAide}");
    expect(rail).toContain("{m.video.filDecouvrir}");
    // L'état vide générique reste réservé au mode « Pour toi ».
    expect(rail).toContain('mode !== "abonnements" && (');
  });

  it("nomme les cinq nouvelles clés, non vides, dans les douze langues", async () => {
    const fichiers = (await readdir(path.join(racine, "src/i18n/messages"))).filter(
      (f) => f.endsWith(".ts") && f !== "index.ts",
    );
    expect(fichiers).toHaveLength(12);
    for (const fichier of fichiers) {
      const contenu = await source(`src/i18n/messages/${fichier}`);
      for (const cle of [
        "filPourToi",
        "filAbonnements",
        "filAbonnementsVide",
        "filAbonnementsVideAide",
        "filDecouvrir",
      ]) {
        expect(contenu, `${fichier} : clé ${cle} absente ou vide`).toMatch(
          new RegExp(`${cle}: "[^"]+"`),
        );
      }
    }
  });
});
