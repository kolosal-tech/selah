# Job d'alertes local — com.selah.alertes

Modèle de job launchd (agent utilisateur) qui exécute périodiquement
`scripts/alertes.mjs` et dépose son résultat dans un fichier de journal.

**Le job n'est pas installé.** Ce document décrit la procédure ; aucun
`launchctl bootstrap` n'a été exécuté. Le modèle est
`scripts/com.selah.alertes.plist`.

**Le script existe et tourne.** `node scripts/alertes.mjs` exécute 13 contrôles
et sort avec le code 0 quand aucun n'est CRITIQUE. Dernière exécution vérifiée
le 11 août 2026 : 13 OK, 0 ATTENTION, 0 CRITIQUE. Le code de sortie est ce que
launchd observe — 1 signifie au moins un contrôle CRITIQUE.

## À quoi sert le job

Rendre périodique une vérification qui est aujourd'hui manuelle. La détection
d'incident sur Selah consiste à lire les Vercel Runtime Logs à la main ; ce
job est le support d'une sonde exécutée sans geste humain, dont la sortie
s'accumule dans un fichier consultable après coup.

Le job est un ordonnanceur, pas une supervision. Sa valeur dépend
entièrement de ce que `scripts/alertes.mjs` mesure.

## Paramètres du modèle

| Clé | Valeur |
|---|---|
| `Label` | `com.selah.alertes` |
| `ProgramArguments` | `/usr/local/bin/node` + chemin absolu du script |
| `StartInterval` | `1800` (30 minutes) |
| `RunAtLoad` | `false` |
| `WorkingDirectory` | racine du dépôt `selah/` |
| `ProcessType` | `Background` |
| `SELAH_ALERTES_LOG` | `~/harness/logs/selah-alertes.log` |

Chemin de `node` relevé par `which node` sur cette machine :
`/usr/local/bin/node` (v24.13.0). Un plist n'interpole ni `$HOME` ni `$PATH` :
tous les chemins sont écrits en dur et devront être corrigés si le dépôt ou
l'installation Node se déplacent.

`RunAtLoad` est absent volontairement : le job est périodique, pas un
one-shot au chargement. Avec `RunAtLoad`, chaque ouverture de session
déclencherait une exécution supplémentaire non désirée.

`StartInterval` compte depuis la fin de l'exécution précédente et ne
rattrape pas les créneaux manqués pendant une veille : à la sortie de veille,
launchd déclenche une exécution unique, pas la file des créneaux perdus.

## Installation

```bash
cp /Users/mskolosalgmail.com/Developer/TIKTOK_CRETIEN/selah/scripts/\
com.selah.alertes.plist ~/Library/LaunchAgents/com.selah.alertes.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.selah.alertes.plist
launchctl print gui/$(id -u)/com.selah.alertes
```

`launchctl print` est le contrôle : il affiche l'état, le code de sortie de
la dernière exécution et les chemins de journal effectifs. Un `bootstrap`
silencieux ne prouve pas que le job s'exécute.

Déclencher une exécution immédiate sans attendre le créneau :

```bash
launchctl kickstart -p gui/$(id -u)/com.selah.alertes
```

## Désinstallation

```bash
launchctl bootout gui/$(id -u)/com.selah.alertes
rm ~/Library/LaunchAgents/com.selah.alertes.plist
```

Le `bootout` seul suffit à arrêter le job pour la session courante ; sans
suppression du fichier, un `bootstrap` ultérieur ou une nouvelle session le
recharge. Les journaux ne sont pas supprimés par `bootout`.

## Journaux

| Fichier | Contenu |
|---|---|
| `~/harness/logs/com.selah.alertes.out.log` | sortie standard du script |
| `~/harness/logs/com.selah.alertes.err.log` | sortie d'erreur du script |
| `~/harness/logs/selah-alertes.log` | applicatif, `SELAH_ALERTES_LOG` |

`SELAH_ALERTES_LOG` pointe sur `selah-alertes.log` et **non** sur
`~/harness/logs/ALERTES.log`, qui appartient déjà à la maintenance
quotidienne du harnais. Mélanger les deux flux rendrait indécidable l'origine
d'une ligne.

Aucune rotation n'est configurée. launchd ouvre les fichiers en append et ne
les tronque jamais : la croissance est à surveiller, ou à traiter par
`newsyslog` / une purge dans le script lui-même.

## Ce que le job ne couvre pas

À énoncer avant toute lecture rassurante de ce document.

- **Il ne notifie personne.** Il écrit un fichier. Aucun e-mail, aucun SMS,
  aucune notification macOS, aucun webhook. Si personne ne lit
  `selah-alertes.log`, une alerte détectée reste invisible.
- **Il n'observe pas la base Supabase.** Ni la disponibilité du projet, ni
  les Security/Performance Advisors, ni l'état des migrations, ni les refus
  RLS.
- **Il n'observe pas le volume d'événements produit.** La ligne
  « > 60 lignes/minute pour un acteur » du runbook reste non instrumentée ;
  `product_events` n'est interrogée par aucune sonde périodique.
- **Il n'observe pas les signalements en attente.** Le seuil « > 24 h sans
  décision » reste une vérification manuelle.
- **Il ne mesure aucun SLO terrain.** LCP, INP et CLS restent non mesurés
  faute de RUM ; ce job ne change rien à ce point.
- **Il ne s'exécute pas machine éteinte ou session fermée.** Un agent
  utilisateur ne tourne que pour une session de bureau ouverte. Une panne
  survenue de nuit sera détectée au réveil, pas pendant.
- **Il n'escalade rien.** Aucun mécanisme de réessai, d'accusé de réception
  ou de rappel n'est prévu.

## Lien avec le runbook

La colonne **Responsable** de `docs/OPERATIONS_RUNBOOK.md` reste « à nommer »
pour les huit signaux du tableau. Ce job ne la remplit pas et n'a pas
vocation à la remplir : automatiser la détection ne désigne pas qui décide ni
qui agit. Un fichier de journal sans destinataire nommé est une trace, pas
une alerte.
