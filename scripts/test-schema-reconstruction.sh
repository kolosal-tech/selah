#!/usr/bin/env bash
set -euo pipefail

container="selah-schema-$RANDOM-$RANDOM"

cleanup() {
  docker stop "$container" >/dev/null 2>&1 || true
  docker rm "$container" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker run -d --name "$container" -v "$PWD:/workspace:ro" \
  -e POSTGRES_HOST_AUTH_METHOD=trust postgres:16-alpine -c wal_level=logical

until docker logs "$container" 2>&1 | grep -Fq 'PostgreSQL init process complete; ready for start up.'; do
  if [[ "$(docker inspect -f '{{.State.Running}}' "$container")" != "true" ]]; then
    docker logs "$container" >&2
    exit 1
  fi
  sleep 0.2
done

docker exec -i "$container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
  < tests/schema-reconstruction.sql >/dev/null

docker exec -i "$container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
  < tests/room-audio-rls.sql >/dev/null

docker exec -i "$container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
  < tests/media-profile-rls.sql >/dev/null

docker exec -i "$container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
  < tests/analytics-rls.sql >/dev/null

docker exec -i "$container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
  < tests/anonymous-events-rls.sql >/dev/null

docker exec -i "$container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
  < tests/blocks-rls.sql >/dev/null

docker exec -i "$container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
  < tests/moderation-safety-rls.sql >/dev/null

docker exec -i "$container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
  < tests/age-mentorship-rls.sql >/dev/null

docker exec -i "$container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
  < tests/account-lifecycle-rls.sql >/dev/null

echo "Schema reconstruction: OK"
