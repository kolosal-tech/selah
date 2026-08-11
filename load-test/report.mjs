#!/usr/bin/env node
/**
 * Depouille la sortie brute k6 (plusieurs centaines de Mo en stress, personne
 * ne l'ouvre) et rend un rapport markdown court.
 *
 * Sort en code 1 si le rapport doit faire echouer le pipeline :
 *   - un seuil est depasse, OU
 *   - k6 est vert alors que Sentry a enregistre des erreurs sur la fenetre.
 *
 * Usage : node report.mjs <config> <outDir> <scenario> <T0> <T1> <k6ExitCode>
 */
import { readFileSync, existsSync, createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import path from 'node:path';

const [configPath, outDir, scenario, t0, t1, k6Code] = process.argv.slice(2);
const config = JSON.parse(readFileSync(configPath, 'utf8'));
const read = (p, fb) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : fb);

const sentry = read(path.join(outDir, 'sentry.json'), { available: false, reason: 'fichier absent' });
const vercel = read(path.join(outDir, 'vercel.json'), { available: false, reason: 'fichier absent' });
const probeBefore = JSON.parse(process.env.PROBE_BEFORE || '{"available":false}');
const probeAfter = JSON.parse(process.env.PROBE_AFTER || '{"available":false}');

const pct = (arr, p) => {
  if (!arr.length) return NaN;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
};
const ms = (n) => (Number.isFinite(n) ? `${Math.round(n)} ms` : '—');
const rate = (n) => (Number.isFinite(n) ? `${(n * 100).toFixed(2)} %` : '—');

// --- Passe unique sur raw.json (JSON Lines), regroupee par nombre de VU ---
const buckets = new Map(); // vus -> {durations[], fails, total}
const all = [];
let markerMisses = 0;
let currentVus = 0;

const rawPath = path.join(outDir, 'raw.json');
if (existsSync(rawPath)) {
  const rl = createInterface({ input: createReadStream(rawPath), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line) continue;
    let p;
    try { p = JSON.parse(line); } catch { continue; }
    if (p.type !== 'Point') continue;

    if (p.metric === 'vus') { currentVus = p.data.value; continue; }
    if (p.metric === 'content_marker_missing' && p.data.value === 1) { markerMisses++; continue; }
    if (p.metric !== 'http_req_duration') continue;
    if (p.data.tags?.scenario === 'witness') { /* garde le temoin a part */ }

    const step = currentVus;
    if (!buckets.has(step)) buckets.set(step, { durations: [], fails: 0, total: 0 });
    const b = buckets.get(step);
    b.durations.push(p.data.value);
    b.total++;
    if (p.data.tags?.expected_response === 'false') b.fails++;
    all.push(p.data.value);
  }
}

// --- Palier de rupture : premier palier qui casse un seuil declare ---
// Seuls les paliers DECLARES comptent. Les valeurs de VU traversees pendant une
// rampe produiraient des dizaines de lignes de bruit a 2 requetes chacune.
const numericThreshold = (metric, pattern, fallback) => {
  for (const rule of config.thresholds?.[metric] ?? []) {
    const match = rule.match(pattern);
    if (match) return Number(match[1]);
  }
  return fallback;
};
const P95_LIMIT = numericThreshold(
  'http_req_duration{scenario:traffic}',
  /p\(95\)<([\d.]+)/,
  1500,
);
const ERR_LIMIT = numericThreshold(
  'http_req_failed{scenario:traffic}',
  /rate<([\d.]+)/,
  0.01,
);
const declared = new Set(
  scenario === 'stress'
    ? (config.stress.steps ?? []).filter((v) => v <= Number(process.env.MAX_VUS || config.stress.maxVus))
        .concat(Number(process.env.MAX_VUS || config.stress.maxVus))
    : [],
);
const paliers = [...buckets.entries()]
  .filter(([vus]) => vus > 0 && (declared.size === 0 || declared.has(vus)))
  .sort((a, b) => a[0] - b[0])
  .map(([vus, b]) => ({
    vus,
    median: pct(b.durations, 50),
    p95: pct(b.durations, 95),
    errRate: b.total ? b.fails / b.total : 0,
    total: b.total,
  }));
const rupture = paliers.find((p) => p.p95 > P95_LIMIT || p.errRate > ERR_LIMIT);

// --- Croisement k6 x Sentry : la table qui decide du verdict ---
const thresholdBreached = Number(k6Code) !== 0;
const httpClean = !thresholdBreached && markerMisses === 0;
let verdict, verdictLevel;
if (!sentry.available && !vercel.available && !httpClean) {
  // Le depassement de seuil se constate sans traceur : il ne doit pas etre
  // masque par l'indisponibilite de Sentry.
  verdict = "ECHEC — seuil(s) depasse(s). Cause non instruite : aucun traceur d'erreurs interroge, on ne sait donc pas ce qui a casse.";
  verdictLevel = 'fail';
} else if (!sentry.available && !vercel.available) {
  verdict = "NON CONCLUANT — aucun seuil depasse, mais aucun traceur d'erreurs interroge. Un « 0 erreur » sans traceur n'a aucune valeur probante : ne pas conclure que ca tient.";
  verdictLevel = 'unknown';
} else if (vercel.available && vercel.countInWindow > 0) {
  verdict = `TIR INVALIDE — Vercel a releve ${vercel.countInWindow} erreur(s) serveur sur la fenetre exacte.`;
  verdictLevel = 'invalid';
} else if (!sentry.available && httpClean && vercel.countInWindow === 0) {
  verdict = 'Tir VALIDE cote HTTP et serveur — aucun seuil depasse, aucun 5xx/log error Vercel sur la fenetre. La telemetrie d erreurs navigateur reste absente.';
  verdictLevel = 'ok';
} else if (httpClean && sentry.countInWindow === 0 && (!vercel.available || vercel.countInWindow === 0)) {
  verdict = 'Tir VALIDE — aucun seuil depasse, aucune erreur applicative sur la fenetre.';
  verdictLevel = 'ok';
} else if (httpClean && sentry.countInWindow > 0) {
  verdict = `TIR INVALIDE — k6 est vert mais Sentry a enregistre ${sentry.countInWindow} issue(s) sur la fenetre exacte. Le tir a valide des pages d'erreur : le verdict k6 ne vaut rien. Cas par defaut sur une application en rendu streaming.`;
  verdictLevel = 'invalid';
} else if (!httpClean && sentry.countInWindow > 0) {
  verdict = 'ECHEC COHERENT — seuils depasses et erreurs applicatives concordantes. Lire la cause dans le traceur.';
  verdictLevel = 'fail';
} else {
  verdict = 'ECHEC SANS TRACE — seuils depasses mais aucune erreur cote traceur. Panne reseau, timeout cote client, ou traceur mal branche.';
  verdictLevel = 'fail';
}

const L = [];
const w = (s = '') => L.push(s);

w(`# Test de charge — \`${scenario}\``);
w();
w(`- Cible : \`${process.env.TARGET_URL || config.baseUrl}\``);
w(`- Fenetre UTC : \`${t0}\` -> \`${t1}\``);
w(`- Requetes mesurees : ${all.length}`);
w(`- Sortie k6 : ${k6Code} ${thresholdBreached ? '**(seuil depasse)**' : '(aucun seuil depasse)'}`);
w();
w(`## Verdict`);
w();
w(`> ${verdict}`);
w();

w(`## Distribution complete`);
w();
w('| Metrique | Valeur |');
w('| --- | --- |');
w(`| mediane | ${ms(pct(all, 50))} |`);
w(`| p90 | ${ms(pct(all, 90))} |`);
w(`| p95 | ${ms(pct(all, 95))} |`);
w(`| p99 | ${ms(pct(all, 99))} |`);
w(`| max | ${ms(all.reduce((m, v) => (v > m ? v : m), Number.NEGATIVE_INFINITY))} |`);
w();
// La queue se lit sur le palier le plus charge : melanger les paliers d'un
// stress dilue la saturation dans les mesures des paliers bas.
const tailSource = paliers.length > 1 ? buckets.get(paliers.at(-1).vus).durations : all;
const tailLabel = paliers.length > 1 ? `au palier ${paliers.at(-1).vus} VU` : 'sur le tir';
const p95t = pct(tailSource, 95), p99t = pct(tailSource, 99);
if (Number.isFinite(p95t) && Number.isFinite(p99t)) {
  w(p99t > p95t * 2
    ? `La queue s'etire ${tailLabel} : p99 vaut ${(p99t / p95t).toFixed(1)}x le p95. Debut de saturation, **avant** que le taux d'erreur bouge.`
    : `Ecart p95 -> p99 contenu ${tailLabel} (${(p99t / p95t).toFixed(1)}x).`);
  w();
}

if (paliers.length > 1) {
  w(`## Palier par palier`);
  w();
  w('| VU simultanes | requetes | mediane | p95 | taux d\'erreur |');
  w('| --- | --- | --- | --- | --- |');
  for (const p of paliers) w(`| ${p.vus} | ${p.total} | ${ms(p.median)} | ${ms(p.p95)} | ${rate(p.errRate)} |`);
  w();
  w(rupture
    ? `**Palier de rupture : ${rupture.vus} VU** (p95 ${ms(rupture.p95)}, erreurs ${rate(rupture.errRate)}).`
    : `**Palier de rupture non atteint** sur cette montee. On ne peut PAS extrapoler au-dela de ${paliers.at(-1).vus} VU : sous la capacite la latence bouge a peine, un cran au-dessus la file s'auto-alimente et tout s'effondre d'un coup.`);
  w();
}

w(`## Erreurs applicatives sur la fenetre du tir`);
w();
if (!sentry.available) {
  w(`Sentry indisponible : ${sentry.reason}`);
  w();
  if (vercel.available) {
    w(`La correlation serveur repose sur les journaux Vercel ci-dessous. La telemetrie d'erreurs navigateur est couverte separement par Playwright, pas par ce tir k6.`);
  } else {
    w(`**Sans traceur d'erreurs, ce tir est a considerer comme non concluant, pas comme reussi.**`);
  }
} else {
  w(`${sentry.countInWindow} issue(s) dont l'activite chevauche \`${t0}\` -> \`${t1}\` (source : ${sentry.source}).`);
  w();
  if (sentry.countInWindow) {
    w('| Issue | Type | Titre | Occurrences (total) | Utilisateurs (total) |');
    w('| --- | --- | --- | --- | --- |');
    for (const i of sentry.issues) w(`| ${i.shortId} | ${i.kind} | ${i.title} | ${i.countTotal} | ${i.userCountTotal} |`);
    w();
    w(`_Le compteur d'occurrences est le **total** de l'issue, jamais celui de la fenetre._`);
    w();
  }
  if (sentry.poolSaturation?.detected) {
    w(`### Saturation de pool detectee`);
    w();
    w(sentry.poolSaturation.hint);
    w();
  }
}

w(`### Journaux serveur Vercel`);
w();
if (!vercel.available) {
  w(`Indisponibles : ${vercel.reason}`);
} else {
  w(`${vercel.countInWindow} requete(s) 5xx ou log(s) de niveau error sur \`${t0}\` -> \`${t1}\` (source : ${vercel.source}).`);
  if (vercel.countInWindow) {
    w();
    w('| Source | Statut | Chemin | Deploiement |');
    w('| --- | --- | --- | --- |');
    for (const item of vercel.errors.slice(0, 20)) {
      w(`| ${item.source ?? '—'} | ${item.status ?? item.level ?? '—'} | ${item.path ?? '—'} | ${item.deploymentId ?? '—'} |`);
    }
  }
}
w();

if (markerMisses > 0) {
  w(`## Marqueurs de contenu manquants`);
  w();
  w(`${markerMisses} reponse(s) sans le marqueur de succes attendu. Un statut 200 a donc ete servi avec une page d'erreur — exactement le mode d'echec que le statut HTTP seul ne voit pas.`);
  w();
}

w(`## Verifications`);
w();
w('### Cache');
w();
w('```');
w(process.env.CACHE_HEADERS?.trim() || 'aucun en-tete de cache renvoye');
w('```');
w(/MISS|no-store/i.test(process.env.CACHE_HEADERS || '')
  ? 'Les pages sont reellement rendues a chaque requete.'
  : "**A verifier** : sans `MISS`/`no-store`, un resultat plat peut venir d'un cache et le chiffre ne prouve rien.");
w();
w('### Sonde de pool');
w();
if (probeBefore.available || probeAfter.available) {
  w('```json');
  w(JSON.stringify({ avant: probeBefore.pool ?? null, apres: probeAfter.pool ?? null }, null, 2));
  w('```');
  w("Rappel : cette sonde ne voit que le pool **local a l'instance qui repond**. En serverless elle en echantillonne une au hasard et ignore la limite du pooler en amont. **Un `waiting` a 0 ne disculpe pas la base.**");
} else {
  w(`Absente (${probeAfter.reason ?? probeBefore.reason ?? 'non declaree'}). La saturation interne n'a donc pas ete mesuree.`);
}
w();

w(`## Ce que ce tir ne dit pas`);
w();
const executedPages = config.pages
  .filter((page) => !page.requiresAuth || Boolean(process.env.AUTH_COOKIE))
  .map((page) => page.path);
const authNote = process.env.AUTH_COOKIE
  ? 'Le feed authentifie a ete exerce avec une session QA partagee entre les VU.'
  : 'Le feed authentifie a ete ignore faute de session QA en memoire.';
w(`- **Pages testees** : ${executedPages.join(', ')} uniquement. ${authNote}`);
w(`- **Profil de montee** : \`${scenario}\`${scenario === 'spike' ? ' (pic instantane, sans rampe)' : ' (montee progressive — laisse a la plateforme le temps d\'ajouter des instances ; un envoi d\'emails massif cree un pic immediat, a rejouer via `spike`)'}.`);
w(`- **Duree** : ce tir ne revele ni les fuites memoire, ni la derive d'un pool sur plusieurs heures.`);
w(`- **Serverless** : \`connexions base >= POOL_MAX x instances actives\`. Chaque instance ouvre son propre pool ; augmenter POOL_MAX sans compter les instances deplace la saturation vers la base.`);
w();

process.stdout.write(L.join('\n'));
process.exit(verdictLevel === 'ok' || verdictLevel === 'unknown' ? 0 : 1);
