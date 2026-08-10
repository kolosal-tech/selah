import { runJourney, targetUrl } from '../lib/journey.js';

// Etape 1/3 — un seul utilisateur. Repond a : "la cible repond-elle avant
// qu'on lui envoie une foule ?". Dure une dizaine de secondes.
export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    // Sur un smoke, la moindre erreur ou le moindre marqueur manquant est bloquant.
    checks: ['rate==1.00'],
    http_req_failed: ['rate==0.00'],
    'http_req_duration{scenario:traffic}': ['p(95)<3000'],
  },
};

export default function smokeScenario() {
  runJourney();
}

export function handleSummary(data) {
  return { stdout: `smoke sur ${targetUrl} : ${data.metrics.checks.values.passes} checks OK\n` };
}
