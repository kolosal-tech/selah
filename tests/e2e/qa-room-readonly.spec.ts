import { expect, test } from "@playwright/test";
import { getQaAccount } from "./fixtures/qa-account";
import { observeRuntime } from "./fixtures/runtime-observer";

const qaAccount = getQaAccount();
test.use({ trace: "off", video: "off", screenshot: "off" });

test.describe("QA authentifiée — room audio sans écriture distante", () => {
  test.skip(!qaAccount, "Aucun compte QA valide n'a été trouvé sans exposer son contenu.");

  test("une room expose l'entrée audio avec microphone coupé avant toute entrée", async ({ page }) => {
    const runtime = observeRuntime(page);
    await page.goto("/login");
    await page.locator('input[name="email"]').fill(qaAccount!.email);
    await page.locator('input[name="password"]').fill(qaAccount!.password);
    await page.locator("form button").last().click();
    await expect(page).not.toHaveURL(/\/login/);

    await page.goto("/rooms");
    const room = page.locator('a[href^="/rooms/"]').first();
    test.skip((await room.count()) === 0, "Aucune room existante : créer une room modifierait les données distantes.");
    await room.click();
    await expect(page.locator('section[aria-label]').filter({ has: page.getByRole("button") })).toBeVisible();
    await expect(page.getByRole("button", { name: /rejoindre.*écouter/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /couper.*micro|activer.*micro/i })).toHaveCount(0);
    runtime.assertClean();
  });
});
