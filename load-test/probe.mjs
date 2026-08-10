#!/usr/bin/env node
/**
 * Interroge la sonde de pool, si le projet en expose une.
 * Rappel du skill : cette sonde ne voit QUE le pool local de l'instance qui
 * repond. En serverless elle en echantillonne une au hasard parmi N, et elle
 * ignore la limite du pooler en amont. Un `waiting` a 0 ne disculpe pas la base.
 */
import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const probe = config.healthProbe;
const done = (o) => { process.stdout.write(JSON.stringify(o)); process.exit(0); };

if (!probe?.path) done({ available: false, reason: 'aucune sonde declaree' });

const token = probe.tokenEnv ? process.env[probe.tokenEnv] : undefined;
const url = `${process.env.TARGET_URL || config.baseUrl}${probe.path}`;
try {
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal: AbortSignal.timeout(10_000),
  });
  // Une sonde bien posee repond 404 sans jeton (un 401 confirmerait son existence).
  if (!res.ok) done({ available: false, reason: `sonde HTTP ${res.status}`, url });
  done({ available: true, url, at: new Date().toISOString(), pool: await res.json() });
} catch (err) {
  done({ available: false, reason: err.message, url });
}
