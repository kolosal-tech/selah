import { expect, test } from "@playwright/test";
import { getQaAccount } from "./fixtures/qa-account";
import { observeRuntime } from "./fixtures/runtime-observer";

const qaAccount = getQaAccount();
const enabled = process.env.E2E_ALLOW_RESET_EMAIL === "1";

// Une demande réelle peut faire apparaître l'adresse QA dans les artefacts.
test.use({ trace: "off", video: "off", screenshot: "off" });

test.describe("QA mutante — demande de réinitialisation", () => {
  test.skip(
    !qaAccount || !enabled,
    "Définis E2E_ALLOW_RESET_EMAIL=1 pour demander une fois un lien au compte QA.",
  );

  test("Supabase accepte la demande sans révéler le compte", async ({ page }) => {
    const runtime = observeRuntime(page);
    await page.goto("/forgot-password");
    await page.locator('input[type="email"]').fill(qaAccount!.email);
    await page.locator("form button").click();
    await expect(page).toHaveURL(/\/forgot-password\?info=accepted$/);
    await expect(page.locator("main")).toContainText(/lien|link/i);
    runtime.assertClean();
  });
});
