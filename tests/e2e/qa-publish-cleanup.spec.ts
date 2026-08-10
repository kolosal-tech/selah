import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { getQaAccounts, type QaAccount } from "./fixtures/qa-account";
import { observeRuntime } from "./fixtures/runtime-observer";

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

const qaAccounts = getQaAccounts();
const publishAccounts = qaAccounts.slice(-2);
const enabled = process.env.E2E_ALLOW_MUTATING_PUBLISH === "1";
// Les traces, vidéos et captures peuvent contenir le parcours connecté.
test.use({ trace: "off", video: "off", screenshot: "off" });

type PublishedMedia = {
  id: string;
  storage_path: string;
  thumb_path: string | null;
};

function cleanupClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Configuration Supabase QA indisponible.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function removePublishedMedia(
  client: SupabaseClient,
  caption: string,
  observedPaths: ReadonlySet<string>,
) {
  const { data: media, error: lookupError } = await client
    .from("videos")
    .select("id, storage_path, thumb_path")
    .eq("caption", caption);
  if (lookupError) throw new Error("Nettoyage QA impossible : lecture des médias refusée.");

  const entries = (media ?? []) as PublishedMedia[];
  const paths = new Set(observedPaths);
  for (const entry of entries) {
    paths.add(entry.storage_path);
    if (entry.thumb_path) paths.add(entry.thumb_path);
  }
  if (entries.length > 0) {
    const { error: deleteRowsError } = await client.from("videos").delete().in(
      "id",
      entries.map((entry) => entry.id),
    );
    if (deleteRowsError) throw new Error("Nettoyage QA incomplet : suppression des lignes refusée.");
  }

  const { data: remaining, error: remainingError } = await client
    .from("videos")
    .select("id")
    .eq("caption", caption);
  if (remainingError || (remaining ?? []).length > 0) {
    throw new Error("Nettoyage QA incomplet : une ligne vidéo subsiste.");
  }

  if (paths.size === 0) return;
  const { error: deleteObjectsError } = await client.storage.from("videos").remove([...paths]);
  if (deleteObjectsError) throw new Error("Nettoyage QA incomplet : suppression Storage refusée.");
  for (const path of paths) {
    const segments = path.split("/");
    const filename = segments.pop();
    const { data: objects, error: listError } = await client.storage
      .from("videos")
      .list(segments.join("/"), { search: filename, limit: 100 });
    if (listError || objects?.some((object) => object.name === filename)) {
      throw new Error("Nettoyage QA incomplet : un objet Storage subsiste.");
    }
  }
}

async function publishAndCleanup(page: Page, kind: "video" | "audio", qaAccount: QaAccount) {
  const runtime = observeRuntime(page);
  const caption = `E2E_QA_${kind}_${randomUUID()}`;
  const client = cleanupClient();
  const observedPaths = new Set<string>();
  page.on("request", (request) => {
    if (!["POST", "PUT"].includes(request.method())) return;
    const marker = "/storage/v1/object/videos/";
    const markerIndex = request.url().indexOf(marker);
    if (markerIndex < 0) return;
    observedPaths.add(decodeURIComponent(request.url().slice(markerIndex + marker.length).split("?", 1)[0]));
  });
  let bodyFailure: unknown;

  try {
    const { error: signInError } = await client.auth.signInWithPassword({
      email: qaAccount.email,
      password: qaAccount.password,
    });
    if (signInError) throw new Error("Authentification du nettoyeur QA refusée.");

    await page.goto("/login");
    await page.locator('input[name="email"]').fill(qaAccount.email);
    await page.locator('input[name="password"]').fill(qaAccount.password);
    await page.locator("form button").last().click();
    await expect(page).not.toHaveURL(/\/login/);

    await page.goto("/videos");
    await page.getByRole("button", { name: kind === "video" ? /^enregistrer$/i : /enregistrer.*audio/i }).click();
    await page.getByRole("button", { name: /démarrer/i }).click();
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: /arrêter/i }).click();
    if (kind === "audio") await expect(page.locator("audio[controls]")).toBeVisible();
    await page.locator('textarea[name="caption"]').fill(caption);
    await page.getByRole("button", { name: /^publier$/i }).click();
    await expect(page.getByText(/publiée/i)).toBeVisible({ timeout: 20_000 });

    await expect.poll(async () => {
      const { data, error } = await client.from("videos").select("id").eq("caption", caption);
      return !error && (data ?? []).length === 1;
    }, { timeout: 15_000 }).toBeTruthy();
  } catch (error) {
    bodyFailure = error;
    throw error;
  } finally {
    try {
      await removePublishedMedia(client, caption, observedPaths);
    } catch (cleanupError) {
      if (bodyFailure) {
        throw new AggregateError([bodyFailure, cleanupError], "Publication QA échouée et nettoyage incomplet.");
      }
      throw cleanupError;
    } finally {
      await client.auth.signOut({ scope: "local" });
    }
  }
  runtime.assertClean();
}

test.describe("QA mutante — publication puis nettoyage garanti", () => {
  test.skip(
    publishAccounts.length < 2 || !enabled,
    "Deux comptes QA distincts et E2E_ALLOW_MUTATING_PUBLISH=1 sont requis après preuve RLS DELETE distante.",
  );

  test("publie une vidéo QA puis supprime ligne et objets propriétaires", async ({ page }) => {
    await publishAndCleanup(page, "video", publishAccounts[0]);
  });

  test("publie un audio QA puis supprime ligne et objets propriétaires", async ({ page }) => {
    await publishAndCleanup(page, "audio", publishAccounts[1]);
  });
});
