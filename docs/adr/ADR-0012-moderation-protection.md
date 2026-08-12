# ADR-0012 — Modération protectrice

## Statut

accepté. 11 août 2026. Cet ADR remplace ADR-0002.

## Contexte

Les neuf catégories fermées sont déjà portées par `REPORT_CATEGORIES` dans
`src/lib/moderation.ts`, et la migration `0014_moderation_audit.sql` décrit le
journal `public.moderation_events`. ADR-0002 documentait l'absence de barème,
de sanctions de compte et de procédure d'appel. Les choix ci-dessous fixent le
cadre produit protecteur ; ils ne prouvent pas que toutes les capacités sont
déjà livrées.

## Décision

Les neuf catégories existantes forment une taxonomie fermée. Chaque
signalement devient un dossier traçable. Un modérateur ou un admin peut masquer
un contenu de manière réversible. Les seules sanctions de compte livrées sont
l'avertissement formel et la restriction temporaire de mentorat, de 7 ou
30 jours, prononcées par un admin.

Il n'existe aucune sanction automatique, aucun bannissement permanent et aucun
effacement comme sanction. Un appel peut être déposé dans les 30 jours ; un
admin distinct de l'émetteur de la sanction l'examine, avec une cible de 7
jours. Un renversement révoque la sanction. Le journal est append-only et les
raisons sont bornées à la taxonomie et au barème.

Responsables : le modérateur assure le triage ; l'admin prononce les sanctions
et traite les appels ; le propriétaire produit Selah maintient le barème. Toute
mesure irréversible reste fermée.

## Conséquences

Le modèle de données et l'interface devront lier chaque action à un dossier,
une raison bornée, un auteur autorisé et un événement append-only. Les contrôles
doivent séparer les rôles de l'émetteur et de l'examinateur d'appel. Le
masquage de contenu est un geste réversible ; une restriction de mentorat doit
expirer automatiquement à 7 ou 30 jours ou être révoquée lors d'un appel admis.

L'absence d'automatisation évite une sanction non examinée, mais augmente la
charge humaine. Les mesures irréversibles restent indisponibles, y compris si
un dossier est grave ; leur ouverture exigerait un ADR successeur.

## Réversibilité

Un masquage se renverse en restaurant la visibilité. Un avertissement ou une
restriction se révoque par un nouvel événement, sans supprimer le journal.
Modifier la taxonomie, les durées ou ouvrir une sanction irréversible exige un
ADR successeur, une migration compatible et une mise à jour du barème.

## Preuves exigées avant ouverture

1. Tests de schéma, RLS et interface prouvant les neuf catégories fermées,
   l'ouverture d'un dossier traçable et le journal append-only à chaque étape.
2. Tests d'autorisation prouvant que seul un modérateur ou admin masque un
   contenu, et que seul un admin prononce avertissement ou restriction 7/30.
3. Tests prouvant l'absence de sanction automatique, de bannissement permanent
   et d'effacement de compte ou de contenu comme sanction.
4. Test d'appel prouvant la fenêtre de 30 jours, l'examinateur admin distinct,
   l'objectif de suivi à 7 jours et la révocation de sanction après renversement.
5. Barème versionné, responsables de triage/sanction/appel nommés et exercice
   de dossier QA réversible sans faux événement persistant dans la production.
