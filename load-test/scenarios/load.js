import { config, loadStages, runJourney } from '../lib/journey.js';

// Etape 2/3 — la charge attendue, montee progressive.
// Repond a : "reste-t-on sous les seuils ?". Seul scenario posable en CI.
export const options = {
  stages: loadStages(),
  thresholds: config.thresholds,
};

export default function loadScenario() {
  runJourney();
}
