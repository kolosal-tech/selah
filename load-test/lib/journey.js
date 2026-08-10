import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

// CONFIG_PATH est injecté par run.sh. Chargé dans le contexte d'init k6.
export const config = JSON.parse(open(__ENV.CONFIG_PATH || '../config.json'));
export const targetUrl = __ENV.TARGET_URL || config.baseUrl;
const authCookie = __ENV.AUTH_COOKIE || '';

export const witnessLatency = new Trend('witness_duration', true);
export const contentFailures = new Rate('content_marker_missing');

export function loadStages() {
  const l = config.load;
  const vus = Number(__ENV.VUS || l.vus);
  return [
    { duration: `${l.rampUpSeconds}s`, target: vus },
    { duration: `${l.steadySeconds}s`, target: vus },
    { duration: `${l.rampDownSeconds}s`, target: 0 },
  ];
}

export function stressStages() {
  const s = config.stress;
  const max = Number(__ENV.MAX_VUS || s.maxVus);
  const steps = s.steps.filter((v) => v < max).concat(max);
  const stages = [];
  for (const target of steps) {
    stages.push({ duration: '10s', target });               // montée vers le palier
    stages.push({ duration: `${s.stepSeconds}s`, target });  // palier tenu
  }
  stages.push({ duration: '15s', target: 0 });
  return stages;
}

export function spikeStages() {
  const sp = config.spike;
  const vus = Number(__ENV.VUS || sp.vus);
  // Pas de rampe : reproduit l'arrivee simultanee d'un envoi d'emails massif.
  return [
    { duration: '1s', target: vus },
    { duration: `${sp.durationSeconds}s`, target: vus },
    { duration: '5s', target: 0 },
  ];
}

/**
 * Un passage complet du parcours.
 * Regle 4 du skill : l'assertion porte sur un marqueur de contenu, jamais sur le
 * seul statut HTTP. En rendu streaming, une erreur serveur arrive dans un 200.
 */
export function runJourney() {
  for (const page of config.pages) {
    if (page.requiresAuth && !authCookie) continue;
    const tags = {
      page: page.tag,
      scenario: page.role === 'witness' ? 'witness' : 'traffic',
    };

    const params = page.requiresAuth
      ? { tags, headers: { Cookie: authCookie }, redirects: 0 }
      : { tags };
    const res = http.get(`${targetUrl}${page.path}`, params);

    const bodyOk =
      typeof res.body === 'string' && res.body.includes(page.marker);

    check(
      res,
      {
        'statut 200': (r) => r.status === 200,
        'marqueur de contenu present': () => bodyOk,
      },
      tags,
    );

    contentFailures.add(bodyOk ? 0 : 1, tags);
    if (page.role === 'witness') witnessLatency.add(res.timings.duration, tags);

    sleep(Math.random() * 2 + 0.5); // temps de lecture d'un visiteur reel
  }
}
