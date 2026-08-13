import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  PRODUCT_EVENT_NAMES,
  PRODUCT_EVENT_OUTCOMES,
  PRODUCT_EVENT_REASONS,
  PRODUCT_EVENT_SURFACES,
} from "@/lib/analytics/events";

/**
 * Un type énuméré n'est pas figé par sa migration de création : une valeur
 * peut lui être ajoutée plus tard par `alter type ... add value`. Ne lire que
 * la migration d'origine ferait échouer la parité à chaque extension, ou pire,
 * la déclarerait vraie alors que la base a divergé.
 */
const MIGRATIONS = readdirSync(
  new URL("../supabase/migrations/", import.meta.url),
)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) =>
    readFileSync(new URL(`../supabase/migrations/${f}`, import.meta.url), "utf8"),
  )
  .join("\n");


/**
 * Retire commentaires de bloc et de ligne. Ces tests cherchent des
 * déclarations ; sans ce filtre, une phrase expliquant qu'un champ est interdit
 * ferait échouer l'assertion qui vérifie son absence.
 */
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

/** Extrait les valeurs d'un `create type ... as enum (...)` de la migration. */
function valeursEnum(nom: string): string[] {
  // Pas de drapeau `s` : `[^)]` et `[^}]` traversent déjà les retours ligne, et
  // la cible TypeScript du build ne permet pas dotAll.
  const bloc = new RegExp(
    `create type public\\.${nom} as enum \\(([^)]*)\\)`,
  ).exec(MIGRATIONS);
  if (!bloc) throw new Error(`type ${nom} absent des migrations`);
  const valeurs = [...bloc[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  // Puis les extensions ultérieures, dans leur ordre d'application.
  const ajouts = new RegExp(
    `alter type public\\.${nom} add value(?: if not exists)? '([a-z_]+)'`,
    "g",
  );
  for (const ajout of MIGRATIONS.matchAll(ajouts)) valeurs.push(ajout[1]);
  return valeurs;
}

describe("catalogue d'événements produit", () => {
  it("reste strictement aligné sur les types énumérés SQL", () => {
    // Une valeur ajoutée d'un seul côté produirait un refus 22P02 en
    // production, invisible en test : la parité est vérifiée ici, pas en vol.
    expect([...PRODUCT_EVENT_NAMES].sort()).toEqual(
      valeursEnum("product_event_name").sort(),
    );
    expect([...PRODUCT_EVENT_SURFACES].sort()).toEqual(
      valeursEnum("product_event_surface").sort(),
    );
    expect([...PRODUCT_EVENT_OUTCOMES].sort()).toEqual(
      valeursEnum("product_event_outcome").sort(),
    );
    expect([...PRODUCT_EVENT_REASONS].sort()).toEqual(
      valeursEnum("product_event_reason").sort(),
    );
  });

  it("couvre chaque portée de quota, y compris celles absentes du TypeScript", () => {
    // `translation` et `room_message` ne sont consommées qu'en base (route API
    // et policy `with check`) : sans elles, ces refus seraient invisibles.
    const portees = [...PRODUCT_EVENT_SURFACES];
    for (const scope of [
      "post",
      "comment",
      "prayer_request",
      "prayer_action",
      "report",
      "translation",
      "video_publish",
      "video_amen",
      "video_comment",
      "video_prayer",
      "follow",
      "room_create",
      "room_message",
      "challenge_create",
    ]) {
      expect(portees).toContain(scope);
    }
  });

  it("n'offre aucun emplacement de texte libre", () => {
    const source = readFileSync(
      new URL("../src/lib/analytics/events.ts", import.meta.url),
      "utf8",
    );
    const typeEvenement = /export type ProductEvent = \{([^}]*)\}/.exec(source);
    expect(typeEvenement).not.toBeNull();
    const corps = typeEvenement![1];
    // Le seul moyen d'écrire une prière dans la mesure serait un champ texte :
    // il ne doit exister ni directement, ni sous forme d'index signature.
    expect(corps).not.toMatch(/string/);
    expect(corps).not.toMatch(/unknown|any|Record<|\[key/);
    // Recherche sur les déclarations, pas sur la prose : les commentaires du
    // module citent justement ces noms pour expliquer leur absence.
    expect(sansCommentaires(source)).not.toMatch(
      /\b(payload|metadata|properties)\s*[?:]/i,
    );
  });
});

describe("écriture des événements", () => {
  const RECORD = readFileSync(
    new URL("../src/lib/analytics/record.ts", import.meta.url),
    "utf8",
  );

  it("n'expose jamais un échec de mesure dans les journaux", () => {
    expect(sansCommentaires(RECORD)).not.toMatch(/console\.\w+\(/);
    expect(RECORD).toMatch(/catch \{/);
  });

  it("laisse la base attribuer l'acteur", () => {
    // Aucun identifiant transmis depuis l'application : `auth.uid()` fait foi.
    expect(sansCommentaires(RECORD)).not.toMatch(/user\.id|actor_id|p_actor/);
  });

  it("reste inerte tant que le flag est fermé", () => {
    expect(RECORD).toMatch(/if \(!isEnabled\("analytics"\)\) return;/);
  });
});
