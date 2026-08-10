import { expect, test, type Locator } from "@playwright/test";
import { getQaAccount } from "./fixtures/qa-account";
import { observeRuntime } from "./fixtures/runtime-observer";

const qaAccount = getQaAccount();
// Les artefacts Playwright peuvent contenir le parcours de connexion : ils
// sont désactivés pour que les identifiants QA ne quittent jamais le processus.
test.use({ trace: "off", video: "off", screenshot: "off" });

async function clickCentered(target: Locator) {
  await target.evaluate((element) => element.scrollIntoView({ block: "center", inline: "center" }));
  await target.click();
}

test.describe("QA authentifiée — média et réglages sans publication", () => {
  test.skip(!qaAccount, "Aucun compte QA valide n'a été trouvé sans exposer son contenu.");

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[name="email"]').fill(qaAccount!.email);
    await page.locator('input[name="password"]').fill(qaAccount!.password);
    await page.locator("form button").last().click();
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("caméra et micro simulés enregistrent puis abandonnent une vidéo", async ({ page }) => {
    const runtime = observeRuntime(page);
    await page.goto("/videos");
    await page.getByRole("button", { name: /^enregistrer$/i }).click();
    await expect(page.getByRole("button", { name: /démarrer/i })).toBeVisible();
    await page.getByRole("button", { name: /démarrer/i }).click();
    await expect(page.getByRole("button", { name: /arrêter/i })).toBeVisible();
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: /arrêter/i }).click();
    await expect(page.locator('textarea[name="caption"]')).toBeVisible();
    await clickCentered(page.getByRole("button", { name: /reprendre/i }));
    await expect(page.getByRole("button", { name: /^enregistrer$/i })).toBeVisible();
    runtime.assertClean();
  });

  test("le micro simulé enregistre un audio puis revient au studio sans publier", async ({ page }) => {
    const runtime = observeRuntime(page);
    await page.goto("/videos");
    await page.getByRole("button", { name: /enregistrer.*audio/i }).click();
    await expect(page.getByRole("button", { name: /démarrer/i })).toBeVisible();
    await page.getByRole("button", { name: /démarrer/i }).click();
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: /arrêter/i }).click();
    await expect(page.locator("audio[controls]")).toBeVisible();
    await clickCentered(page.getByRole("button", { name: /reprendre/i }));
    await expect(page.getByRole("button", { name: /enregistrer.*audio/i })).toBeVisible();
    runtime.assertClean();
  });

  test("les réglages de profil sont désactivés par défaut et restent locaux", async ({ page }) => {
    const runtime = observeRuntime(page);
    await page.goto("/profile");
    const switches = page.locator('input[role="switch"]');
    await expect(switches).toHaveCount(3);
    await expect(switches.nth(0)).not.toBeChecked();
    await expect(switches.nth(1)).not.toBeChecked();
    await expect(switches.nth(2)).not.toBeChecked();
    await clickCentered(switches.nth(2).locator("xpath=.."));
    await expect(switches.nth(2)).toBeChecked();
    await expect(page.locator("html")).toHaveAttribute("data-reduced-motion", "true");
    runtime.assertClean();
  });
});
