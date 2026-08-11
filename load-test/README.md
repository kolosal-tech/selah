# load-test/ — harnais copiable

Harnais Selah. Les marqueurs de contenu couvrent les pages publiques et le
manifest statique, qui sert de témoin indépendant de Supabase Auth.

```bash
./load-test/run.sh smoke
VUS=100     ./load-test/run.sh load
MAX_VUS=150 ./load-test/run.sh stress
VUS=100     ./load-test/run.sh spike

# Le cookie est injecté uniquement en mémoire et n'est jamais écrit au rapport.
# Sans lui, le feed authentifié est ignoré et les pages publiques restent testées.
AUTH_COOKIE='…' VUS=100 ./load-test/run.sh load

# Variante recommandée : construit le cookie en mémoire depuis le compte QA
# local ignoré par Git, puis le détruit avec le processus.
node load-test/run-qa.mjs load

# Cible distante : confirmation humaine + seuils approuvés obligatoires
TARGET_URL=https://exemple.vercel.app ./load-test/run.sh smoke
```

| Fichier | Role |
| --- | --- |
| `run.sh` | orchestrateur : prerequis, garde-fou cible non locale, fenetre UTC T0->T1, tir, correlation, rapport, code de sortie 4 si seuil depasse |
| `run-qa.mjs` | ouvre une session QA éphémère en mémoire pour exercer le feed serveur authentifié |
| `config.json` | parcours Selah, marqueurs publics/authentifiés, seuils approuvés et profil 100 VU |
| `lib/journey.js` | parcours partage, assertions sur le **contenu** et pas sur le statut |
| `scenarios/*.js` | smoke / load / stress / spike |
| `sentry-correlate.mjs` | issues dont l'activite chevauche la fenetre du tir, detection des erreurs de pool |
| `vercel-correlate.mjs` | 5xx et logs serveur `error` sur la fenêtre UTC exacte |
| `probe.mjs` | lecture de la sonde de pool, si le projet en expose une |
| `report.mjs` | dépouillement : distribution, palier par palier, palier de rupture, croisement k6 x observateurs d'erreurs |

Acces Sentry : `SENTRY_AUTH_TOKEN` + `sentry.org`/`sentry.project` dans `config.json`,
ou la CLI `sentry` installee. Sur Selah, les journaux runtime Vercel 5xx/error
servent d'observateur serveur equivalent sur la fenetre exacte. Si aucun des
deux observateurs n'est disponible, le rapport reste **non concluant**.

Codes de sortie de `run.sh` : `0` OK, `1` prerequis, `2` cible injoignable,
`3` tir annule, `4` **seuil depasse** (fait echouer un pipeline CI).
En CI, ne poser que `load`. Jamais `stress`.
