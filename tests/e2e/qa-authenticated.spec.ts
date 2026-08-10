import { expect, test } from "@playwright/test";
import { observeRuntime } from "./fixtures/runtime-observer";

const qaEmail = process.env.E2E_QA_EMAIL;
const qaPassword = process.env.E2E_QA_PASSWORD;
const hasQaAccount = Boolean(qaEmail && qaPassword);
test.use({ trace: "off", video: "off", screenshot: "off" });

test.describe("parcours QA authentifié (lecture seule)", () => {
  test.skip(!hasQaAccount, "Configure E2E_QA_EMAIL et E2E_QA_PASSWORD pour ce parcours non destructif.");

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[name="email"]').fill(qaEmail!);
    await page.locator('input[name="password"]').fill(qaPassword!);
    await page.locator("form button").last().click();
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("navigation, profil, studio média et rooms sont accessibles sans mutation", async ({ page }) => {
    const runtime = observeRuntime(page);
    await page.goto("/profile");
    await expect(page.getByRole("main")).toBeVisible();
    expect(await page.locator('input[type="file"]').count()).toBeGreaterThan(0);
    const viewport = page.viewportSize();
    const headerControls = page.locator("header").first().locator("a, button, select");
    for (let index = 0; index < await headerControls.count(); index += 1) {
      const box = await headerControls.nth(index).boundingBox();
      expect(box?.x).toBeGreaterThanOrEqual(0);
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(viewport?.width ?? 0);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    await page.goto("/videos");
    expect(await page.locator('input[type="file"]').count()).toBeGreaterThan(0);

    await page.goto("/rooms");
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.locator("form button").first()).toBeVisible();
    runtime.assertClean();
  });

  test("le feed actif est focalisable et activable au clavier", async ({ page }) => {
    const runtime = observeRuntime(page);
    await page.goto("/");
    await expect(page.locator('[data-load-marker="selah-authenticated-feed-v1"]')).toBeVisible();

    const activeVideo = page.locator('video[role="button"][tabindex="0"]');
    test.skip((await activeVideo.count()) === 0, "Le feed QA ne contient aucune vidéo active.");
    await activeVideo.focus();
    await expect(activeVideo).toBeFocused();
    await expect(activeVideo).toHaveAttribute("aria-pressed", "false");
    await page.keyboard.press("Enter");
    await expect(activeVideo).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Space");
    await expect(activeVideo).toHaveAttribute("aria-pressed", "false");

    const follow = page.getByRole("button", { name: /suivre/i }).first();
    if (await follow.count()) {
      const box = await follow.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
    runtime.assertClean();
  });
});
