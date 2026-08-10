#!/usr/bin/env bash
set -euo pipefail

container="selah-rls-$RANDOM-$RANDOM"

cleanup() {
  docker stop "$container" >/dev/null 2>&1 || true
  docker rm "$container" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker run -d --name "$container" -v "$PWD:/workspace:ro" \
  -e POSTGRES_HOST_AUTH_METHOD=trust postgres:16-alpine

# `pg_isready` becomes true during the temporary init server as well.  Wait for
# the entrypoint to switch to its final server before loading the fixture.
until docker logs "$container" 2>&1 | grep -Fq 'PostgreSQL init process complete; ready for start up.'; do
  if [[ "$(docker inspect -f '{{.State.Running}}' "$container")" != "true" ]]; then
    docker logs "$container" >&2
    exit 1
  fi
  sleep 0.2
done

docker exec -i "$container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
  < tests/rls-baseline.sql >/dev/null

as_alice() {
  docker exec "$container" psql -v ON_ERROR_STOP=1 -At -U postgres -d postgres -c \
    "set role authenticated; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false); $1"
}

as_moderator() {
  docker exec "$container" psql -v ON_ERROR_STOP=1 -At -U postgres -d postgres -c \
    "set role authenticated; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', false); $1"
}

expect_fail() {
  if as_alice "$1" >/dev/null 2>&1; then
    echo "La requête devait être refusée : $1" >&2
    exit 1
  fi
}

expect_exact() {
  local actual
  actual="$(as_alice "$1")"
  if [[ "$actual" != *"$2"* ]]; then
    echo "Résultat inattendu : $actual (attendu : $2)" >&2
    exit 1
  fi
}

expect_fail "update public.profiles set role = 'admin' where id = auth.uid();"
expect_fail "select author_id from public.prayer_requests;"
expect_exact "select coalesce(username, 'anonyme') from public.prayer_requests_public where id = '00000000-0000-0000-0000-000000000011';" "anonyme"
expect_exact "select count(*) from public.videos where id = '00000000-0000-0000-0000-000000000021';" "0"
expect_exact "select count(*) from storage.objects where name like '%video.mp4';" "0"
expect_exact "select count(*) from public.video_storage_orphans;" "0"
moderator_orphans="$(as_moderator "select count(*) from public.video_storage_orphans;")"
if [[ "$moderator_orphans" != *"1"* ]]; then
  echo "Inventaire Storage inattendu : $moderator_orphans" >&2
  exit 1
fi
moderator_missing="$(as_moderator "select count(*) from public.video_storage_missing;")"
if [[ "$moderator_missing" != *"1"* ]]; then
  echo "Références Storage manquantes inattendues : $moderator_missing" >&2
  exit 1
fi
expect_fail "update storage.objects set metadata = '{\"cacheControl\": \"3600\"}'::jsonb where name = '00000000-0000-0000-0000-000000000001/retry.mp4';"
expect_fail "insert into public.videos (id, author_id, storage_path, hidden) values ('00000000-0000-0000-0000-000000000023', auth.uid(), '00000000-0000-0000-0000-000000000001/forced.mp4', true);"
expect_fail "insert into public.videos (id, author_id, storage_path, caption, verse_ref, type, duration_s) values ('00000000-0000-0000-0000-000000000024', auth.uid(), '00000000-0000-0000-0000-000000000001/paused.mp4', 'pause', '', 'temoignage', 1);"
expect_fail "insert into storage.objects (bucket_id, name) values ('videos', '00000000-0000-0000-0000-000000000001/paused.mp4');"
expect_fail "insert into public.mentor_offers (user_id, topics) values (auth.uid(), 'écoute');"
expect_fail "insert into public.mentorships (mentor_id, mentee_id) values ('00000000-0000-0000-0000-000000000002', auth.uid());"
expect_exact "select bool_and(public.consume_rate_limit('room_message')) from generate_series(1, 12);" "t"
expect_exact "select public.consume_rate_limit('room_message');" "f"
expect_fail "insert into public.room_messages (room_id, author_id, body) values ('00000000-0000-0000-0000-000000000032', auth.uid(), 'message limité');"
expect_fail "insert into public.room_messages (room_id, author_id, body) values ('00000000-0000-0000-0000-000000000031', auth.uid(), 'message fermé');"
expect_exact "select bool_and(public.consume_rate_limit('translation')) from generate_series(1, 12);" "t"
expect_exact "select public.consume_rate_limit('translation');" "f"
expect_fail "insert into public.reports (reporter_id, reason) values (auth.uid(), 'sans cible');"
expect_fail "insert into public.reports (reporter_id, post_id, reason) values (auth.uid(), '00000000-0000-0000-0000-000000000041', 'x');"
expect_exact "insert into public.reports (reporter_id, post_id, reason) values (auth.uid(), '00000000-0000-0000-0000-000000000041', 'signalement valide');" "INSERT 0 1"
expect_exact "select count(*) from public.moderation_events;" "0"
moderator_audit="$(as_moderator "update public.reports set status = 'traite' where reporter_id = '00000000-0000-0000-0000-000000000001'; select count(*) from public.moderation_events where action = 'report_status_changed';")"
if [[ "$moderator_audit" != *"1"* ]]; then
  echo "Journal de modération inattendu : $moderator_audit" >&2
  exit 1
fi
expect_exact "insert into public.comments (post_id, author_id, body) values ('00000000-0000-0000-0000-000000000041', auth.uid(), 'commentaire'); select comment_count from public.posts where id = '00000000-0000-0000-0000-000000000041';" "1"
expect_exact "delete from public.comments where post_id = '00000000-0000-0000-0000-000000000041' and author_id = auth.uid(); select comment_count from public.posts where id = '00000000-0000-0000-0000-000000000041';" "0"
expect_exact "update public.profiles set lang = 'en' where id = auth.uid() returning lang;" "en"

echo "RLS baseline: OK"
