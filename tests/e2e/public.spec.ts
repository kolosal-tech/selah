import { expect, test } from "@playwright/test";
import { observeRuntime } from "./fixtures/runtime-observer";

test.describe("parcours public et authentification", () => {
  test("la découverte présente les entrées principales sans débordement horizontal", async ({ page }) => {
    const runtime = observeRuntime(page);
    await page.goto("/decouvrir");

    await expect(page.getByRole("heading", { name: "Selah" })).toBeVisible();
    await expect(page.locator('a[href="/login"]')).toBeVisible();
    await expect(page.locator('a[href="/signup"]')).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow).toBeFalsy();
    runtime.assertClean();
  });

  test("le mot de passe peut être affiché et le reset est accessible", async ({ page }) => {
    const runtime = observeRuntime(page);
    await page.goto("/login?error=invalid-credentials");

    const password = page.locator('input[name="password"]');
    await expect(password).toHaveAttribute("type", "password");
    const toggle = password.locator("xpath=..//button");
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await toggle.click();
    await expect(password).toHaveAttribute("type", "text");
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await toggle.click();
    await expect(password).toHaveAttribute("type", "password");

    await expect(page.locator("aside")).toBeVisible();
    const reset = page.locator('a[href="/forgot-password"]').first();
    await expect(reset).toBeVisible();
    await reset.click();
    await expect(page).toHaveURL(/\/forgot-password$/);
    await expect(page.locator('input[type="email"]')).toBeVisible();
    runtime.assertClean();
  });

  test("les écrans d'authentification restent utilisables sur petit écran", async ({ page }) => {
    const runtime = observeRuntime(page);
    await page.goto("/signup");
    await expect(page.locator('input[name="nom"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow).toBeFalsy();
    runtime.assertClean();
  });
});
