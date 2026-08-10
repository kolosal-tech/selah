#!/usr/bin/env node
/**
 * Collecte les erreurs Sentry dont l'activite CHEVAUCHE la fenetre du tir.
 * Sans ce filtre, le rapport impute au test des bugs vieux de plusieurs jours.
 *
 * Deux acces, dans l'ordre :
 *   1. SENTRY_AUTH_TOKEN  -> API HTTP (aucune installation)
 *   2. CLI `sentry`       -> sentry issue list --json
 * Aucun des deux : sortie {available:false, reason}. Le tir n'est pas bloque,
 * mais le rapport declarera le verdict NON CONCLUANT.
 *
 * Usage : node sentry-correlate.mjs <config.json> <T0 ISO-8601 Z> <T1 ISO-8601 Z>
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const [configPath, t0, t1] = process.argv.slice(2);
const config = JSON.parse(readFileSync(configPath, 'utf8'));
const { org, project, environment } = config.sentry ?? {};

const out = (o) => { process.stdout.write(JSON.stringify(o, null, 2)); process.exit(0); };

// Une issue compte si son intervalle [firstSeen, lastSeen] recoupe [T0, T1].
const overlaps = (issue) => {
  const first = Date.parse(issue.firstSeen);
  const last = Date.parse(issue.lastSeen);
  return Number.isFinite(first) && Number.isFinite(last)
    && last >= Date.parse(t0) && first <= Date.parse(t1);
};

const POOL_PATTERNS = [
  /EMAXCONNSESSION/i,
  /max clients reached/i,
  /remaining connection slots/i,
  /too many connections/i,
  /sorry, too many clients/i,
  /Connection( pool)? timeout/i,
  /timeout exceeded when trying to connect/i,
  /Client has encountered a connection error/i,
  /ECONNRESET.*(postgres|pg|supabase)/i,
];

const classify = (issue) => {
  const text = `${issue.title ?? ''} ${issue.culprit ?? ''} ${issue.metadata?.value ?? ''}`;
  if (POOL_PATTERNS.some((re) => re.test(text))) return 'pool';
  if (/prisma|postgres|pg |sql|supabase/i.test(text)) return 'database';
  return 'other';
};

const shape = (issues) => {
  const windowed = issues.filter(overlaps).map((i) => ({
    shortId: i.shortId,
    title: i.title,
    culprit: i.culprit,
    kind: classify(i),
    // Attention : `count` est le TOTAL de l'issue, pas celui de la fenetre.
    countTotal: Number(i.count ?? 0),
    userCountTotal: Number(i.userCount ?? 0),
    firstSeen: i.firstSeen,
    lastSeen: i.lastSeen,
    permalink: i.permalink,
  }));
  const poolIssues = windowed.filter((i) => i.kind === 'pool');
  return {
    available: true,
    window: { t0, t1 },
    countInWindow: windowed.length,
    poolSaturation: {
      detected: poolIssues.length > 0,
      issues: poolIssues,
      // Le diagnostic le plus frequent derriere EMAXCONNSESSION en serverless.
      hint: poolIssues.length
        ? "Erreurs de pool detectees pendant le tir. Verifier le MODE DU POOLER avant toute autre chose : port 5432 = mode session (une connexion monopolisee par client, s'effondre en serverless), port 6543 = mode transaction (connexion rendue apres chaque transaction). Changement de chaine de connexion, zero ligne de code. Verifier ensuite POOL_MAX x instances actives < limite du serveur."
        : null,
    },
    issues: windowed,
    countTotalIsIssueLifetime: true,
  };
};

// --- 1. API HTTP ---
const token = process.env.SENTRY_AUTH_TOKEN;
if (token && org && project && org !== 'REMPLACER') {
  const host = process.env.SENTRY_URL ?? 'https://sentry.io';
  const qs = new URLSearchParams({
    query: `is:unresolved${environment ? ` environment:${environment}` : ''}`,
    statsPeriod: '24h',
    limit: '100',
  });
  const url = `${host}/api/0/projects/${org}/${project}/issues/?${qs}`;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${await res.text()}`);
    out({ source: 'api', ...shape(await res.json()) });
  } catch (err) {
    process.stderr.write(`API Sentry : ${err.message}\n`);
  }
}

// --- 2. CLI `sentry` (la nouvelle, pas l'ancien sentry-cli releases) ---
try {
  const args = ['issue', 'list', '--json', '--fields',
    'shortId,title,culprit,count,userCount,firstSeen,lastSeen,permalink'];
  if (org && project && org !== 'REMPLACER') args.push(`${org}/${project}`);
  const raw = execFileSync('sentry', args, { encoding: 'utf8', timeout: 60_000 });
  out({ source: 'cli', ...shape(JSON.parse(raw)) });
} catch (err) {
  process.stderr.write(`CLI sentry : ${err.message}\n`);
}

out({
  available: false,
  window: { t0, t1 },
  reason: "Aucun acces Sentry. Definir SENTRY_AUTH_TOKEN + sentry.org/sentry.project dans config.json, ou installer la CLI `sentry`. Sans traceur, un verdict \"0 erreur\" n'a AUCUNE valeur probante.",
});
