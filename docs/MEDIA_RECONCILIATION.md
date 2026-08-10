# Réconciliation des médias

Les vues ci-dessous sont réservées aux rôles `moderateur` et `admin`. Elles
signalent des incohérences mais ne suppriment aucun fichier ; une suppression
doit être confirmée après examen et tracée dans le dossier de modération.

```sql
select * from public.video_storage_orphans order by created_at;
select * from public.video_storage_missing order by source, video_id;
```

À exécuter avant une purge planifiée, après un incident d'upload, puis dans le
cadre de l'exploitation décidée à la prépublication. Les objets de moins de
24 heures doivent être exclus d'une purge afin de ne pas supprimer un upload
encore en cours de finalisation.
