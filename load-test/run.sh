#!/usr/bin/env bash
# Orchestrateur de test de charge.
#   ./load-test/run.sh smoke
#   VUS=20  ./load-test/run.sh load
#   MAX_VUS=200 ./load-test/run.sh stress
#   VUS=200 ./load-test/run.sh spike
#
# Codes de sortie :
#   0  tout est passe
#   1  erreur d'usage / prerequis manquant
#   2  cible injoignable
#   3  tir annule par l'operateur (garde-fou cible non locale)
#   4  SEUIL DEPASSE  <- c'est celui qui fait echouer un pipeline CI
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG="${CONFIG:-$HERE/config.json}"
SCENARIO="${1:-}"

die() { printf '\033[31m%s\033[0m\n' "$*" >&2; exit "${2:-1}"; }
info() { printf '\033[36m%s\033[0m\n' "$*"; }
warn() { printf '\033[33m%s\033[0m\n' "$*"; }

case "$SCENARIO" in
  smoke|load|stress|spike) ;;
  *) die "usage: run.sh <smoke|load|stress|spike>" 1 ;;
esac

command -v k6   >/dev/null || die "k6 absent. Installer : brew install k6" 1
command -v node >/dev/null || die "node absent (necessaire au rapport)" 1
[ -f "$CONFIG" ] || die "config absente : $CONFIG (copier config.example.json)" 1

CONFIG_BASE_URL="$(node -e "process.stdout.write(require('$CONFIG').baseUrl)")"
TARGET_URL="${TARGET_URL:-$CONFIG_BASE_URL}"

# --- Garde-fou : jamais de tir hors local sans confirmation humaine explicite ---
case "$TARGET_URL" in
  http://localhost*|http://127.0.0.1*|http://0.0.0.0*) ;;
  *)
    THRESHOLDS_APPROVED="$(node -e "process.stdout.write(String(require('$CONFIG').thresholdsApproved === true))")"
    [ "$THRESHOLDS_APPROVED" = "true" ] || die "Seuils non validés dans $CONFIG. Tir distant refusé." 3
    warn "Cible NON LOCALE : $TARGET_URL"
    warn "Scenario : $SCENARIO. Un stress ou un spike peut mettre ce service a terre."
    if [ -n "${CONFIRM_NON_LOCAL:-}" ]; then
      # Voie non interactive : exige le meme mot exact, fournit par un humain
      # ayant deja confirme hors de ce script (chat, CI approuvee a la main).
      # Ne remplace pas la confirmation humaine, ne fait que changer son canal.
      [ "$CONFIRM_NON_LOCAL" = "TIRER" ] || die "CONFIRM_NON_LOCAL invalide. Tir refuse." 3
      info "Confirmation recue via CONFIRM_NON_LOCAL."
    elif [ -t 0 ]; then
      printf 'Taper exactement TIRER pour confirmer : '
      read -r CONFIRM
      [ "$CONFIRM" = "TIRER" ] || die "Tir annule." 3
    else
      die "Cible non locale, pas de terminal interactif, et CONFIRM_NON_LOCAL absent. Tir refuse." 3
    fi
    ;;
esac

# --- Cible vivante ? ---
CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$TARGET_URL/" || true)"
[ "$CODE" = "000" ] && die "Cible injoignable : $TARGET_URL" 2
info "Cible $TARGET_URL repond ($CODE)"

# --- Verification cache : un resultat plat vient souvent d'un cache ---
CACHE_HEADERS="$(curl -sI --max-time 15 "$TARGET_URL/" | grep -iE 'cache-control|x-vercel-cache|x-cache|age' || true)"

# --- Sonde de pool (facultative, degrade sans bloquer) ---
PROBE_BEFORE="$(TARGET_URL="$TARGET_URL" node "$HERE/probe.mjs" "$CONFIG" 2>/dev/null || echo '{"available":false}')"

RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$HERE/runs/$RUN_ID-$SCENARIO"
mkdir -p "$OUT"

T0="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
info "T0 = $T0 — lancement du scenario $SCENARIO"

CONFIG_PATH="$CONFIG" k6 run \
  --out "json=$OUT/raw.json" \
  --summary-export "$OUT/summary.json" \
  -e CONFIG_PATH="$CONFIG" \
  -e TARGET_URL="$TARGET_URL" \
  ${VUS:+-e VUS="$VUS"} \
  ${MAX_VUS:+-e MAX_VUS="$MAX_VUS"} \
  "$HERE/scenarios/$SCENARIO.js" 2>&1 | tee "$OUT/k6.log"
K6_CODE="${PIPESTATUS[0]}"

T1="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
info "T1 = $T1"

PROBE_AFTER="$(TARGET_URL="$TARGET_URL" node "$HERE/probe.mjs" "$CONFIG" 2>/dev/null || echo '{"available":false}')"

# --- Corrélation traceur d'erreurs sur la fenetre exacte T0 -> T1 ---
node "$HERE/sentry-correlate.mjs" "$CONFIG" "$T0" "$T1" > "$OUT/sentry.json" 2>"$OUT/sentry.err" \
  || warn "Correlation Sentry indisponible — voir $OUT/sentry.err (le rapport le dira)"

# Vercel est l'observateur serveur de Selah : on interroge uniquement les 5xx
# et les logs de niveau error sur la même fenêtre, sans recopier le trafic.
node "$HERE/vercel-correlate.mjs" "$TARGET_URL" "$T0" "$T1" > "$OUT/vercel.json" 2>"$OUT/vercel.err" \
  || warn "Correlation Vercel indisponible — voir $OUT/vercel.err (le rapport le dira)"

# --- Rapport ---
REPORT="$HERE/reports/$RUN_ID-$SCENARIO.md"
mkdir -p "$HERE/reports"
CACHE_HEADERS="$CACHE_HEADERS" TARGET_URL="$TARGET_URL" \
PROBE_BEFORE="$PROBE_BEFORE" PROBE_AFTER="$PROBE_AFTER" \
node "$HERE/report.mjs" "$CONFIG" "$OUT" "$SCENARIO" "$T0" "$T1" "$K6_CODE" > "$REPORT"
RPT_CODE=$?

info "Rapport : $REPORT"
sed -n '1,40p' "$REPORT"

# k6 sort 99 quand un seuil est depasse -> on le traduit en 4 pour la CI.
if [ "$K6_CODE" -ne 0 ] || [ "$RPT_CODE" -ne 0 ]; then
  die "SEUIL DEPASSE ou tir en echec (k6=$K6_CODE, rapport=$RPT_CODE)" 4
fi
