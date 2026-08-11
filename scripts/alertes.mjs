#!/usr/bin/env node
// alertes.mjs — contrôles de production Selah (Node 24, sans dépendance).
//
// PORTÉE ET LIMITES — à lire avant d'interpréter un rapport.
//
// Ce script est une DÉTECTION MANUELLE OU PLANIFIÉE, pas un système
// d'alerte temps réel. Il n'observe rien entre deux exécutions : sa
// fenêtre d'observation est l'instant précis où il tourne. Une panne
// qui commence et se termine entre deux passages ne laisse aucune
// trace ici, et l'absence de CRITIQUE dans un rapport ne dit rien de
// la minute qui a précédé ni de celle qui suit.
//
// Il ne notifie personne. Il écrit un rapport sur stdout, l'ajoute au
// journal, et rend un code de sortie : 0 si aucun contrôle n'est
// CRITIQUE, 1 sinon. C'est ce code que l'appelant — launchd, en
// pratique — est chargé d'observer.
//
// CONFIDENTIALITÉ. Aucun cookie, jeton ni en-tête d'autorisation
// n'est affiché ni écrit. Des quatre en-têtes de sécurité contrôlés,
// seule la PRÉSENCE est rapportée, jamais la valeur. La sortie de
// `vercel logs` n'est jamais recopiée : elle est réduite à des
// compteurs, car une ligne de journal peut contenir une URL portant
// un jeton.
//
// Usage    : node scripts/alertes.mjs
// Journal  : $SELAH_ALERTES_LOG (défaut ~/harness/logs/ALERTES.log)
// Réglages : $SELAH_ALERTES_FENETRE (défaut 1h) pour `vercel logs`.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HOTE = 'selah-wheat.vercel.app';
const CHEMINS = ['/login', '/decouvrir', '/manifest.json'];

// Seuil repris de docs/SLO.md, tableau « Objectifs de service
// serveur », ligne « Latence des parcours » : p95 < 1500 ms. Ici la
// comparaison porte sur une mesure unique, pas sur un p95 : un
// dépassement isolé est un signal, pas une violation d'objectif.
const SEUIL_LATENCE_MS = 1500;

const DELAI_HTTP_MS = 10_000;
const DELAI_VERCEL_MS = 45_000;

const ENTETES_SECURITE = [
  'content-security-policy',
  'strict-transport-security',
  'x-frame-options',
  'x-content-type-options',
];

const RACINE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

const JOURNAL =
  process.env.SELAH_ALERTES_LOG ||
  path.join(process.env.HOME ?? '.', 'harness', 'logs', 'ALERTES.log');

const lignes = [];
const compteurs = { OK: 0, ATTENTION: 0, CRITIQUE: 0 };

/** Ajoute une ligne de contrôle au rapport. */
function noter(niveau, texte) {
  compteurs[niveau] += 1;
  lignes.push(`${niveau.padEnd(9)} ${texte}`);
}

/**
 * Réduit un texte issu d'un processus externe : masque toute suite
 * assez longue pour être un jeton, aplatit et tronque.
 */
function nettoyer(texte) {
  return String(texte ?? '')
    .replace(/[A-Za-z0-9_-]{24,}/g, '[valeur masquée]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

/**
 * Requête HTTPS GET sans suivi de redirection. Le temps mesuré court
 * de l'ouverture de la requête à la fin de la lecture du corps.
 */
function interroger(chemin) {
  return new Promise((resoudre) => {
    const debut = process.hrtime.bigint();
    const ecoule = () =>
      Math.round(Number(process.hrtime.bigint() - debut) / 1e6);

    const requete = https.request(
      {
        hostname: HOTE,
        port: 443,
        path: chemin,
        method: 'GET',
        headers: { 'user-agent': 'selah-alertes/1', accept: '*/*' },
        timeout: DELAI_HTTP_MS,
      },
      (reponse) => {
        reponse.resume();
        reponse.on('end', () =>
          resoudre({
            ok: true,
            statut: reponse.statusCode,
            entetes: reponse.headers,
            ms: ecoule(),
          }),
        );
        reponse.on('error', (err) =>
          resoudre({ ok: false, erreur: err.message, ms: ecoule() }),
        );
      },
    );

    requete.on('timeout', () => {
      requete.destroy(new Error(`délai de ${DELAI_HTTP_MS} ms dépassé`));
    });
    requete.on('error', (err) =>
      resoudre({ ok: false, erreur: err.message, ms: ecoule() }),
    );
    requete.end();
  });
}

/** Localise l'exécutable vercel : le PATH de launchd est minimal. */
function trouverVercel() {
  const candidats = [
    process.env.SELAH_VERCEL_BIN,
    path.join(process.env.HOME ?? '', '.npm-global', 'bin', 'vercel'),
    '/opt/homebrew/bin/vercel',
    '/usr/local/bin/vercel',
  ].filter(Boolean);

  for (const candidat of candidats) {
    try {
      if (fs.statSync(candidat).isFile()) return candidat;
    } catch {
      // Candidat absent : on essaie le suivant.
    }
  }
  return 'vercel'; // Résolu via PATH, ENOENT s'il est absent.
}

/**
 * Corrélation serveur. Toute impossibilité d'exécuter la commande est
 * rapportée comme « corrélation serveur non exécutée » : le script ne
 * prétend jamais avoir vérifié ce qu'il n'a pas pu lire.
 */
function correlerJournauxServeur() {
  const fenetre = process.env.SELAH_ALERTES_FENETRE || '1h';
  const binaire = trouverVercel();
  const nonExecutee = (raison) =>
    noter(
      'ATTENTION',
      `journaux serveur — corrélation serveur non exécutée (${raison})`,
    );

  let resultat;
  try {
    resultat = spawnSync(
      binaire,
      [
        'logs',
        '--environment', 'production',
        '--no-branch',
        '--level', 'error',
        '--since', fenetre,
        '--limit', '100',
        '--json',
        '--no-color',
        '--non-interactive',
      ],
      {
        cwd: RACINE,
        encoding: 'utf8',
        timeout: DELAI_VERCEL_MS,
        maxBuffer: 8 * 1024 * 1024,
      },
    );
  } catch (err) {
    nonExecutee(`lancement impossible : ${nettoyer(err.message)}`);
    return;
  }

  if (resultat.error) {
    const code = resultat.error.code;
    if (code === 'ENOENT') {
      nonExecutee('commande `vercel` introuvable');
    } else if (code === 'ETIMEDOUT') {
      nonExecutee(`délai de ${DELAI_VERCEL_MS} ms dépassé`);
    } else {
      nonExecutee(nettoyer(resultat.error.message));
    }
    return;
  }

  if (resultat.signal) {
    nonExecutee(`interrompue par ${resultat.signal}`);
    return;
  }

  if (resultat.status !== 0) {
    const erreur = nettoyer(resultat.stderr).toLowerCase();
    const raison = /log in|login|not authenticated|credentials|token/.test(
      erreur,
    )
      ? 'CLI vercel non authentifiée'
      : `code de sortie ${resultat.status}`;
    nonExecutee(raison);
    return;
  }

  // Sortie en JSON Lines. On ne recopie aucun contenu : on compte.
  const brutes = String(resultat.stdout ?? '')
    .split('\n')
    .map((ligne) => ligne.trim())
    .filter((ligne) => ligne.startsWith('{'));

  let entrees = 0;
  let illisibles = 0;
  const parStatut = new Map();

  for (const ligne of brutes) {
    let objet;
    try {
      objet = JSON.parse(ligne);
    } catch {
      illisibles += 1;
      continue;
    }
    entrees += 1;
    const statut =
      objet?.statusCode ??
      objet?.status ??
      objet?.proxy?.statusCode ??
      null;
    const cle = Number.isInteger(statut) ? String(statut) : 'inconnu';
    parStatut.set(cle, (parStatut.get(cle) ?? 0) + 1);
  }

  if (illisibles > 0 && entrees === 0) {
    nonExecutee(`${illisibles} ligne(s) de sortie non exploitable(s)`);
    return;
  }

  if (entrees === 0) {
    noter(
      'OK',
      `journaux serveur — aucune erreur sur les ${fenetre} écoulées`,
    );
    return;
  }

  const detail = [...parStatut.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([statut, nombre]) => `${statut}: ${nombre}`)
    .join(', ');
  noter(
    'ATTENTION',
    `journaux serveur — ${entrees} erreur(s) sur ${fenetre} (${detail})`,
  );
}

async function executer() {
  const horodatage = new Date().toISOString();
  const mesures = [];
  let entetesEvalues = false;

  // 1. Disponibilité.
  for (const chemin of CHEMINS) {
    const reponse = await interroger(chemin);
    if (!reponse.ok) {
      noter(
        'CRITIQUE',
        `disponibilité ${chemin} — échec réseau : ` +
          `${nettoyer(reponse.erreur)}`,
      );
      continue;
    }
    mesures.push({ chemin, ms: reponse.ms });
    if (reponse.statut === 200) {
      noter(
        'OK',
        `disponibilité ${chemin} — 200 en ${reponse.ms} ms`,
      );
    } else {
      noter(
        'CRITIQUE',
        `disponibilité ${chemin} — ${reponse.statut} au lieu de 200 ` +
          `(${reponse.ms} ms)`,
      );
    }
    if (chemin === '/login') {
      // 3. En-têtes de sécurité, sur la réponse déjà obtenue.
      entetesEvalues = true;
      for (const entete of ENTETES_SECURITE) {
        const present =
          reponse.entetes[entete] !== undefined &&
          String(reponse.entetes[entete]).trim() !== '';
        if (present) {
          noter('OK', `en-tête ${entete} — présent sur /login`);
        } else {
          noter('CRITIQUE', `en-tête ${entete} — absent sur /login`);
        }
      }
    }
  }

  // Si /login n'a pas répondu, les en-têtes n'ont pas été lus. On le
  // dit ligne à ligne plutôt que de les omettre : un contrôle absent
  // du rapport se lit trop facilement comme un contrôle réussi. Le
  // niveau reste ATTENTION, un en-tête non évalué n'étant pas un
  // en-tête manquant ; le défaut de disponibilité, lui, est CRITIQUE.
  if (!entetesEvalues) {
    for (const entete of ENTETES_SECURITE) {
      noter(
        'ATTENTION',
        `en-tête ${entete} — non évalué, /login n'a pas répondu`,
      );
    }
  }

  // 2. Redirection : la garde d'authentification doit renvoyer 307.
  const racine = await interroger('/');
  if (!racine.ok) {
    noter(
      'CRITIQUE',
      `redirection / — échec réseau : ${nettoyer(racine.erreur)}`,
    );
  } else if (racine.statut === 307) {
    noter('OK', "redirection / — 307, garde d'authentification active");
  } else if (racine.statut === 200) {
    noter(
      'CRITIQUE',
      "redirection / — 200 : la garde d'authentification est tombée, " +
        'le fil est servi sans session',
    );
  } else {
    noter(
      'ATTENTION',
      `redirection / — ${racine.statut} au lieu de 307, comportement ` +
        'inattendu de la garde',
    );
  }
  if (racine.ok) mesures.push({ chemin: '/', ms: racine.ms });

  // 4. Latence.
  for (const mesure of mesures) {
    if (mesure.ms > SEUIL_LATENCE_MS) {
      noter(
        'ATTENTION',
        `latence ${mesure.chemin} — ${mesure.ms} ms, au-dessus du ` +
          `seuil de ${SEUIL_LATENCE_MS} ms`,
      );
    } else {
      noter(
        'OK',
        `latence ${mesure.chemin} — ${mesure.ms} ms, seuil ` +
          `${SEUIL_LATENCE_MS} ms`,
      );
    }
  }

  // 5. Erreurs serveur.
  correlerJournauxServeur();

  const sortie = compteurs.CRITIQUE > 0 ? 1 : 0;
  const total = compteurs.OK + compteurs.ATTENTION + compteurs.CRITIQUE;
  const entete =
    `=== Selah — contrôles de production — ${horodatage} — ` +
    `https://${HOTE} ===`;
  const synthese =
    `--- synthèse : ${total} contrôles — ${compteurs.OK} OK, ` +
    `${compteurs.ATTENTION} ATTENTION, ${compteurs.CRITIQUE} CRITIQUE ` +
    `— code de sortie ${sortie}`;

  const rapport = [entete, ...lignes, synthese].join('\n');
  process.stdout.write(`${rapport}\n`);

  try {
    fs.mkdirSync(path.dirname(JOURNAL), { recursive: true });
    fs.appendFileSync(JOURNAL, `${rapport}\n\n`, 'utf8');
  } catch (err) {
    process.stderr.write(
      `journal non écrit (${JOURNAL}) : ${nettoyer(err.message)}\n`,
    );
  }

  process.exitCode = sortie;
}

executer().catch((err) => {
  process.stderr.write(`alertes.mjs — exception : ${nettoyer(err?.stack)}\n`);
  process.exitCode = 1;
});
