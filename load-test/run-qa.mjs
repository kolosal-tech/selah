#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { createServerClient } from "@supabase/ssr";

function readPublicEnvironment() {
  const values = {};
  for (const filename of [".env.local", ".env.production"]) {
    let document;
    try {
      document = readFileSync(resolve(process.cwd(), filename), "utf8");
    } catch {
      continue;
    }
    for (const line of document.split("\n")) {
      const match = /^(NEXT_PUBLIC_SUPABASE_(?:URL|ANON_KEY))=(.*)$/.exec(line.trim());
      if (match && !values[match[1]]) {
        values[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
      }
    }
  }
  return values;
}

function readQaAccount() {
  const document = readFileSync(resolve(process.cwd(), "docs/COMPTES-TEST.md"), "utf8");
  const sharedPassword = document
    .split("\n")
    .find((line) => /mot de passe/i.test(line))
    ?.match(/`([^`]+)`/)?.[1];
  const emailPattern = /^[^\s|`]+@[^\s|`]+\.[^\s|`]+$/;
  for (const line of document.split("\n")) {
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").map((cell) => cell.trim());
    const email = cells.find((cell) => emailPattern.test(cell.replaceAll("`", "")))
      ?.replaceAll("`", "");
    const rowPassword = cells
      .map((cell) => /^`([^`]+)`$/.exec(cell)?.[1])
      .find(Boolean);
    if (email && (sharedPassword ?? rowPassword)) {
      return { email, password: sharedPassword ?? rowPassword };
    }
  }
  throw new Error("Compte QA introuvable.");
}

const scenario = process.argv[2];
if (!scenario) throw new Error("Usage : node load-test/run-qa.mjs <scenario>");

const environment = readPublicEnvironment();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? environment.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? environment.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error("Configuration publique Supabase absente.");

const account = readQaAccount();
const cookieJar = new Map();
const client = createServerClient(url, key, {
  cookies: {
    getAll: () => [...cookieJar].map(([name, value]) => ({ name, value })),
    setAll: (cookies) => {
      for (const cookie of cookies) {
        if (!cookie.value || cookie.options?.maxAge === 0) cookieJar.delete(cookie.name);
        else cookieJar.set(cookie.name, cookie.value);
      }
    },
  },
});

const { error } = await client.auth.signInWithPassword(account);
if (error || cookieJar.size === 0) throw new Error("Session QA de charge refusée.");

const cookieHeader = [...cookieJar]
  .map(([name, value]) => `${name}=${value}`)
  .join("; ");
const result = spawnSync("bash", ["load-test/run.sh", scenario], {
  cwd: process.cwd(),
  stdio: "inherit",
  env: { ...process.env, AUTH_COOKIE: cookieHeader },
});

await client.auth.signOut({ scope: "local" });
process.exit(result.status ?? 1);
