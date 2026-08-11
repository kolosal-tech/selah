import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function source(relatif: string) {
  return readFile(path.join(racine, relatif), "utf8");
}

function valeursEnum(sql: string, nom: string): string[] {
  const bloc = new RegExp(`create type public\\.${nom} as enum \\(([^)]*)\\)`).exec(sql);
  if (!bloc) throw new Error(`type ${nom} absent`);
  return [...bloc[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
}

function constanteTs(source: string, nom: string): string[] {
  const bloc = new RegExp(`${nom} = \\[([^\\]]*)\\]`).exec(source);
  if (!bloc) throw new Error(`constante ${nom} absente`);
  return [...bloc[1].matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
}

describe("mise à distance d'un auteur", () => {
  it("garde les trois gestes alignés entre le code et la base", async () => {
    const migration = await source(
      "supabase/migrations/20260811170000_blocages_et_taxonomie.sql",
    );
    const moderation = await source("src/lib/moderation.ts");

    expect(constanteTs(moderation, "BLOCK_KINDS").sort()).toEqual(
      valeursEnum(migration, "block_kind").sort(),
    );
    expect(constanteTs(moderation, "REPORT_CATEGORIES").sort()).toEqual(
      valeursEnum(migration, "report_category").sort(),
    );
  });

  it("distingue retirer du fil et amortir", async () => {
    const migration = await source(
      "supabase/migrations/20260811170000_blocages_et_taxonomie.sql",
    );
    // `mute` et `block` excluent l'auteur ; `not_interested` le garde avec un
    // score amorti. Confondre les trois retirerait un auteur simplement moins
    // intéressant, sans retour possible.
    expect(migration).toContain("b.kind in ('mute', 'block')");
    expect(migration).toContain("b.kind = 'not_interested'");
    expect(migration).toContain("facteur_interet");
  });

  it("ne révèle jamais un blocage à la personne visée", async () => {
    const migration = await source(
      "supabase/migrations/20260811170000_blocages_et_taxonomie.sql",
    );
    // La policy de lecture ne mentionne que `blocker_id` : aucune formulation
    // ne doit ouvrir la liste à `blocked_id`.
    // Capture jusqu'au point-virgule : `[^)]*` s'arrêterait à la parenthèse
    // fermante de `auth.uid()` et tronquerait le prédicat.
    const lecture =
      /create policy "lire ses propres blocages"[\s\S]*?using \(([\s\S]*?)\);/.exec(
        migration,
      );
    expect(lecture).not.toBeNull();
    expect(lecture![1]).toContain("blocker_id = auth.uid()");
    expect(lecture![1]).not.toContain("blocked_id");
  });

  it("empêche l'abonnement en base, pas seulement dans l'application", async () => {
    const migration = await source(
      "supabase/migrations/20260811170000_blocages_et_taxonomie.sql",
    );
    // Une garde applicative seule serait contournable par un appel direct à
    // PostgREST : le refus doit vivre dans la policy.
    expect(migration).toContain('create policy "suivre un auteur qui ne m\'a pas bloqué"');
    expect(migration).toContain("b.blocker_id = followed_id");
  });

  it("retire l'abonnement existant lors d'un blocage", async () => {
    const actions = await source("src/app/actions.ts");
    // Sans cela, l'auteur resterait listé dans « Abonnements » après avoir
    // disparu du fil : un état incohérent que l'utilisateur ne peut pas résoudre.
    const bloc = /export async function blockAuthor[\s\S]*?\n}/.exec(actions);
    expect(bloc).not.toBeNull();
    expect(bloc![0]).toContain('if (kind === "block")');
    expect(bloc![0]).toContain('.from("follows")');
    expect(bloc![0]).toContain(".delete()");
  });

  it("offre toujours l'annulation du geste", async () => {
    const actions = await source("src/app/actions.ts");
    expect(actions).toContain("export async function unblockAuthor");
  });

  it("refuse de se bloquer soi-même, en base et dans l'action", async () => {
    const migration = await source(
      "supabase/migrations/20260811170000_blocages_et_taxonomie.sql",
    );
    const actions = await source("src/app/actions.ts");
    expect(migration).toContain("check (blocker_id <> blocked_id)");
    expect(actions).toContain("authorId === user.id");
    // Un module `"use server"` ne peut exporter que des fonctions asynchrones :
    // les constantes doivent rester hors de `actions.ts`, sinon le build casse.
    expect(actions).not.toMatch(/export const (BLOCK_KINDS|REPORT_CATEGORIES)/);
  });
});
