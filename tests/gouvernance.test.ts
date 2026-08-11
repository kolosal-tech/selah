import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dossierAdr = path.join(racine, "docs", "adr");

function lire(relatif: string): string {
  return readFileSync(path.join(racine, relatif), "utf8");
}

const FICHIERS_ADR = readdirSync(dossierAdr)
  .filter((f) => f.startsWith("ADR-") && f.endsWith(".md"))
  .sort();

const RUBRIQUES = [
  "## Statut",
  "## Contexte",
  "## Décision",
  "## Conséquences",
  "## Réversibilité",
  "## Preuves exigées avant ouverture",
];

const STATUTS = ["proposé", "accepté", "bloqué", "remplacé"];

describe("journal des décisions d'architecture", () => {
  it("couvre les neuf sujets de la vague 0", () => {
    expect(FICHIERS_ADR).toHaveLength(9);
    for (let i = 1; i <= 9; i += 1) {
      const numero = `ADR-000${i}`;
      expect(FICHIERS_ADR.some((f) => f.startsWith(numero))).toBe(true);
    }
  });

  it.each(FICHIERS_ADR)("%s porte les six rubriques et un statut fermé", (nom) => {
    const contenu = readFileSync(path.join(dossierAdr, nom), "utf8");
    for (const rubrique of RUBRIQUES) {
      expect(contenu).toContain(rubrique);
    }

    const statut = /## Statut\s+([^\n]+)/.exec(contenu);
    expect(statut).not.toBeNull();
    const premierMot = statut![1].trim().toLowerCase();
    expect(STATUTS.some((s) => premierMot.startsWith(s))).toBe(true);

    // Le titre porte son propre numéro : un fichier renuméroté sans son titre
    // rendrait l'index et les renvois croisés faux.
    expect(contenu.split("\n")[0]).toContain(nom.slice(0, 8));
  });

  it("garde l'index aligné sur les fichiers réellement présents", () => {
    const index = lire("docs/adr/README.md");
    for (const nom of FICHIERS_ADR) {
      // Un index qui décrit un sujet inexistant est pire qu'une absence
      // d'index : il donne l'illusion qu'une décision est consignée.
      expect(index).toContain(`(${nom})`);
    }
    for (const statut of STATUTS) {
      expect(index.toLowerCase()).toContain(statut);
    }
  });
});

describe("objectifs de service et exploitation", () => {
  const slo = lire("docs/SLO.md");
  const runbook = lire("docs/OPERATIONS_RUNBOOK.md");

  it("distingue non mesuré, à valider et à nommer plutôt qu'un flou unique", () => {
    // « à définir » ne dit pas lequel des trois manque : la mesure, la
    // validation ou la personne. Les trois formules le disent.
    expect(slo).not.toContain("à définir");
    expect(runbook).not.toContain("à définir");
    expect(slo).toMatch(/non mesuré/);
    expect(slo).toMatch(/à valider/);
    expect(runbook).toMatch(/à nommer/);
  });

  it("reprend les seuils réellement configurés pour la charge", () => {
    const config = JSON.parse(lire("load-test/config.json")) as {
      thresholds: Record<string, string[]>;
    };
    expect(config.thresholds["http_req_duration{scenario:traffic}"]).toContain(
      "p(95)<1500",
    );
    // Le document doit citer les mêmes nombres que le harnais, sinon un seuil
    // relevé dans `config.json` laisserait un objectif périmé dans la doc.
    expect(slo).toMatch(/p95 < ?1[  ]?500 ms/);
    expect(slo).toMatch(/p95 < ?800 ms/);
  });

  it("nomme les composants à risque sans en effacer l'historique", () => {
    const journal = lire("docs/ARCHITECTURE_JOURNAL.md");
    for (const sujet of [
      "WebRTC",
      "quarantaine",
      "/api/",
      "télémétrie",
      "product_events",
    ]) {
      expect(journal).toContain(sujet);
    }
  });
});
