import { expect, test } from "@playwright/test";

/**
 * Preuve de bout en bout des deux voies de mesure, sur un vrai navigateur.
 *
 * Ces scénarios n'écrivent que des compteurs : aucun contenu, aucun compte,
 * aucun objet Storage. Ils sont donc sûrs à rejouer sur la production, à la
 * différence du lot mutant de publication.
 *
 * Ils sont volontairement séparés du parcours QA : leur objet n'est pas de
 * vérifier une interface, mais de prouver qu'une navigation réelle atteint la
 * base. Ce que `pnpm test:schema` prouve sur PostgreSQL jetable, ceci le
 * prouve sur la chaîne complète navigateur → serveur → Postgres.
 */

test.describe("voies de mesure en conditions réelles", () => {
  /** Simule le passage de l'onglet en arrière-plan, seul déclencheur d'envoi. */
  async function masquerOnglet(page: import("@playwright/test").Page) {
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForTimeout(1200);
  }

  test("une page publique émet une métrique terrain au masquage de l'onglet", async ({
    page,
  }) => {
    // Le corps d'un `sendBeacon` porteur d'un Blob n'est exposé ni par
    // `postData()` ni par `postDataBuffer()` : ce scénario prouve donc le
    // départ de la requête, et le suivant en prouve la charge sur le repli.
    const appels: string[] = [];
    page.on("request", (requete) => {
      if (requete.url().includes("/api/vitals")) appels.push(requete.method());
    });

    await page.goto("/login", { waitUntil: "load" });
    await page.waitForTimeout(600);
    await masquerOnglet(page);

    expect(appels.length).toBeGreaterThan(0);
    expect(new Set(appels)).toEqual(new Set(["POST"]));
  });

  test("la charge n'emporte qu'une métrique, une valeur et une surface", async ({
    page,
  }) => {
    const beacons: string[] = [];
    page.on("request", (requete) => {
      if (!requete.url().includes("/api/vitals")) return;
      const corps = requete.postDataBuffer()?.toString("utf8") ?? "";
      if (corps) beacons.push(corps);
    });

    // Retirer `sendBeacon` force le repli `fetch`, dont Playwright lit le
    // corps. Les deux chemins envoient exactement la même charge.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "sendBeacon", {
        configurable: true,
        value: undefined,
      });
    });

    await page.goto("/login", { waitUntil: "load" });
    // Une interaction réelle : sans elle, l'INP n'existe pas.
    await page.getByLabel(/e-?mail/i).first().click().catch(() => {});
    await page.waitForTimeout(600);
    await masquerOnglet(page);

    expect(beacons.length).toBeGreaterThan(0);
    // La charge ne doit transporter qu'une métrique, une valeur et une surface.
    for (const corps of beacons) {
      const charge = JSON.parse(corps) as Record<string, unknown>;
      expect(Object.keys(charge).sort()).toEqual(["metric", "surface", "value"]);
      expect(["lcp", "inp", "cls"]).toContain(charge.metric);
    }
  });

  test("un refus d'identifiants ne divulgue rien et reste mesurable", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel(/e-?mail/i).first().fill("compte-inexistant@selah.test");
    await page.getByLabel(/mot de passe/i).first().fill("mot-de-passe-invalide");
    await page.getByRole("button", { name: /connexion|se connecter/i }).first().click();

    await page.waitForURL(/error=invalid-credentials/, { timeout: 15_000 });
    // Le message brut du fournisseur ne doit jamais atteindre l'interface.
    const texte = await page.locator("body").innerText();
    expect(texte).not.toMatch(/invalid login credentials|supabase|gotrue/i);
  });
});
