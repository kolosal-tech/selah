#!/usr/bin/env node
import { execFileSync } from "node:child_process";

const [targetUrl, t0, t1] = process.argv.slice(2);

function fetchLogs(filterArgs) {
  const output = execFileSync(
    "vercel",
    [
      "logs",
      targetUrl,
      "--environment",
      "production",
      "--since",
      t0,
      "--until",
      t1,
      "--limit",
      "1000",
      "--json",
      "--no-branch",
      ...filterArgs,
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  return output
    .split("\n")
    .filter((line) => line.trim().startsWith("{"))
    .map((line) => JSON.parse(line));
}

try {
  if (!targetUrl || !t0 || !t1) throw new Error("arguments absents");
  const rows = [
    ...fetchLogs(["--status-code", "5xx"]),
    ...fetchLogs(["--level", "error"]),
  ];
  const byId = new Map(rows.map((row) => [row.id, row]));
  const errors = [...byId.values()].map((row) => ({
    id: row.id,
    level: row.level,
    path: row.requestPath,
    status: row.responseStatusCode,
    source: row.source,
    deploymentId: row.deploymentId,
  }));
  process.stdout.write(JSON.stringify({
    available: true,
    source: "Vercel runtime logs",
    countInWindow: errors.length,
    errors,
  }));
} catch (error) {
  process.stdout.write(JSON.stringify({
    available: false,
    reason: error instanceof Error ? error.message.split("\n")[0] : "erreur inconnue",
  }));
  process.exitCode = 1;
}
