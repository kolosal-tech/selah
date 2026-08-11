import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { getQaAccounts, type QaAccount } from "./fixtures/qa-account";

/**
 * Preuve de bout en bout des gestes de mise à distance, sur la cible réelle.
 *
 * Le scénario écrit une ligne `user_blocks` puis l'annule par le bouton du
 * toast : l'état final est identique à l'état initial. Le nettoyage de
 * sécurité supprime en outre tout blocage résiduel du compte QA, que la RLS
 * borne de toute façon à ses propres lignes.
 *
 * Lot mutant : ne s'exécute que sous E2E_ALLOW_MUTATING_BLOCKS=1.
 */

function loadPublicSupabaseEnvironment() {
  for (const filename of [".env.local", ".env.production", ".env"]) {
    const path = resolve(process.cwd(), filename);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const match = /^(NEXT_PUBLIC_SUPABASE_(?:URL|ANON_KEY))=(.*)$/.exec(line.trim());
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  }
}

loadPublicSupabaseEnvironment();

const comptes = getQaAccounts();
const enabled = process.env.E2E_ALLOW_MUTATING_BLOCKS === "1";
// Le parcours est connecté : aucune trace ni capture ne doit être conservée.
test.use({ trace: "off", video: "off", screenshot: "off" });

function clientQa(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Configuration Supabase QA indisponible.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function sessionQa(compte: QaAccount) {
  const client = clientQa();
  const { data, error } = await client.auth.signInWithPassword({
    email: compte.email,
    password: compte.password,
  });
  if (error || !data.user) throw new Error("Connexion QA côté vérification impossible.");
  return { client, userId: data.user.id };
}

test.describe("gestes de mise à distance (mutant, nettoyé)", () => {
  test.skip(!enabled, "Tir mutant désactivé sans E2E_ALLOW_MUTATING_BLOCKS=1.");
  test.skip(comptes.length === 0, "Compte QA indisponible.");

  test.afterEach(async () => {
    // Filet : aucun blocage résiduel du compte QA, même si le test a échoué
    // avant l'annulation. La RLS borne le delete à ses propres lignes.
    const { client, userId } = await sessionQa(comptes[0]);
    await client.from("user_blocks").delete().eq("blocker_id", userId);
    await client.auth.signOut();
  });

  test("masquer un auteur écrit la ligne, l'annulation la retire", async ({
    page,
  }) => {
    const { client, userId } = await sessionQa(comptes[0]);

    // Reproduire le tri servi par la page pour connaître l'auteur en tête de
    // fil ; si c'était le compte QA lui-même, le geste serait refusé à juste
    // titre et le scénario n'aurait rien à prouver.
    const { data: tete } = await client
      .from("videos_feed")
      .select("author_id")
      .order("rang_auteur", { ascending: true })
      .order("score", { ascending: false })
      .order("id", { ascending: true })
      .limit(1);
    const auteurCible = tete?.[0]?.author_id as string | undefined;
    test.skip(!auteurCible, "Fil vide : rien à masquer.");
    test.skip(auteurCible === userId, "La tête de fil appartient au compte QA.");

    await page.goto("/login");
    await page.getByLabel(/e-?mail/i).first().fill(comptes[0].email);
    await page.getByLabel(/mot de passe|password/i).first().fill(comptes[0].password);
    await page.getByRole("button", { name: /connexion|se connecter|log in|sign in/i }).first().click();
    await page.waitForURL((url) => new URL(url).pathname === "/", { timeout: 20_000 });

    await page.getByRole("button", { name: /plus d'options|more options/i }).first().waitFor({
      timeout: 20_000,
    });
    await page.getByRole("button", { name: /plus d'options|more options/i }).first().click();
    await page.getByRole("button", { name: /^masquer |^mute /i }).click();

    // La preuve n'est pas le toast : c'est la ligne en base, écrite par la
    // Server Action sous la session du navigateur.
    await expect
      .poll(
        async () => {
          const { data } = await client
            .from("user_blocks")
            .select("blocked_id, kind")
            .eq("blocker_id", userId);
          return data?.length ?? 0;
        },
        { timeout: 10_000 },
      )
      .toBe(1);

    const { data: lignes } = await client
      .from("user_blocks")
      .select("blocked_id, kind")
      .eq("blocker_id", userId);
    expect(lignes?.[0]?.kind).toBe("mute");
    expect(lignes?.[0]?.blocked_id).toBe(auteurCible);

    // Annulation par le bouton du toast, dans sa fenêtre de cinq secondes.
    await page.getByRole("button", { name: /annuler|undo|cancel/i }).click();
    // Attendre la fin visible de la Server Action avant de fermer la page :
    // sinon Playwright peut couper le flux RSC dès que la base est propre.
    await expect(page.getByText(/c'est annulé|undone/i)).toBeVisible();

    await expect
      .poll(
        async () => {
          const { data } = await client
            .from("user_blocks")
            .select("blocked_id")
            .eq("blocker_id", userId);
          return data?.length ?? 0;
        },
        { timeout: 10_000 },
      )
      .toBe(0);

    await client.auth.signOut();
  });

  test("la page des comptes éloignés liste puis annule un geste durable", async ({ page }) => {
    const { client, userId } = await sessionQa(comptes[0]);
    const { data: tete } = await client
      .from("videos_feed")
      .select("author_id")
      .order("rang_auteur", { ascending: true })
      .order("score", { ascending: false })
      .order("id", { ascending: true })
      .limit(1);
    const auteurCible = tete?.[0]?.author_id as string | undefined;
    test.skip(!auteurCible || auteurCible === userId, "Auteur QA cible indisponible.");

    const { error: insertError } = await client.from("user_blocks").insert({
      blocker_id: userId,
      blocked_id: auteurCible,
      kind: "not_interested",
    });
    expect(insertError).toBeNull();

    await page.goto("/login");
    await page.getByLabel(/e-?mail/i).first().fill(comptes[0].email);
    await page.getByLabel(/mot de passe|password/i).first().fill(comptes[0].password);
    await page.getByRole("button", { name: /connexion|se connecter|log in|sign in/i }).first().click();
    await page.waitForURL((url) => new URL(url).pathname === "/", { timeout: 20_000 });
    await page.goto("/profile");
    await page.getByRole("link", { name: /gérer les comptes mis à distance/i }).click();
    await page.waitForURL((url) => new URL(url).pathname === "/profile/blocked");

    await expect(page.getByText(/^moins présent$/i)).toBeVisible();
    const annuler = page.getByRole("button", { name: /annuler la mise à distance/i });
    const boite = await annuler.boundingBox();
    expect(boite?.height ?? 0).toBeGreaterThanOrEqual(44);
    const largeur = await page.evaluate(() => ({
      contenu: document.documentElement.scrollWidth,
      fenetre: document.documentElement.clientWidth,
    }));
    expect(largeur.contenu).toBeLessThanOrEqual(largeur.fenetre);
    await annuler.click();
    await expect
      .poll(
        async () => {
          const { data } = await client
            .from("user_blocks")
            .select("blocked_id")
            .match({ blocker_id: userId, blocked_id: auteurCible });
          return data?.length ?? 0;
        },
        { timeout: 10_000 },
      )
      .toBe(0);
    await expect(page.getByRole("listitem")).toHaveCount(0);
    await expect(page.getByText(/aucun compte/i)).toBeVisible();

    await client.auth.signOut();
  });
});
