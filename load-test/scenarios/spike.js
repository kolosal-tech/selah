import { config, spikeStages, runJourney } from '../lib/journey.js';

// Hors des trois etapes : pic instantane, sans rampe.
// Reproduit un envoi d'emails massif — profil que la montee progressive ne couvre pas.
export const options = {
  stages: spikeStages(),
  thresholds: config.thresholds,
  thresholdsAbortOnFail: false,
};

export default function spikeScenario() {
  runJourney();
}
