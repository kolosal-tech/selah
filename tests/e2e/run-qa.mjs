import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const emailPattern = /^[^\s|`]+@[^\s|`]+\.[^\s|`]+$/;
const document = readFileSync(resolve(process.cwd(), "docs/COMPTES-TEST.md"), "utf8");
const documentedPassword = document
  .split("\n")
  .find((line) => /mot de passe/i.test(line))
  ?.match(/`([^`]+)`/)?.[1];
const accounts = document.split("\n").reduce((found, line) => {
  if (!line.startsWith("|")) return found;
  const cells = line.split("|").map((cell) => cell.trim());
  const email = cells.find((cell) => emailPattern.test(cell.replaceAll("`", "")))?.replaceAll("`", "");
  const password = cells
    .map((cell) => /^`([^`]+)`$/.exec(cell)?.[1])
    .find(Boolean);
  if (email && (documentedPassword ?? password) && !found.some((entry) => entry.email === email)) {
    found.push({ email, password: documentedPassword ?? password });
  }
  return found;
}, []);

if (accounts.length === 0) {
  throw new Error("Compte QA introuvable dans docs/COMPTES-TEST.md.");
}

const executable = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const result = spawnSync(executable, ["exec", "playwright", "test", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: {
    ...process.env,
    E2E_QA_EMAIL: accounts[0].email,
    E2E_QA_PASSWORD: accounts[0].password,
    E2E_QA_ACCOUNTS: JSON.stringify(accounts),
  },
});

process.exit(result.status ?? 1);
