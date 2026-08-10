import { config, stressStages, runJourney } from '../lib/journey.js';

// Etape 3/3 — paliers croissants jusqu'a MAX_VUS.
// Repond a : "a partir de combien ca lache ?". Jamais en CI.
// Les seuils restent declares : un stress sans seuil est un graphique, pas un test.
export const options = {
  stages: stressStages(),
  thresholds: config.thresholds,
  // Un depassement ne doit pas couper le tir : on veut voir OU ca casse.
  thresholdsAbortOnFail: false,
};

export default function stressScenario() {
  runJourney();
}
