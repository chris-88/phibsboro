#!/usr/bin/env bash
# Gates the publish. AC6 no sourcemap is served, AC7 no secret reached the bundle,
# AC9 the custom domain file survives the build when one is configured.
set -euo pipefail

DIST=${1:-dist}
fail() { echo "verify-dist: $1" >&2; exit 1; }

[ -d "$DIST" ] || fail "$DIST does not exist"

# AC6 — a sourcemap on a public origin hands the reader the whole source tree.
maps=$(find "$DIST" -name '*.map' -type f)
if [ -n "$maps" ]; then
  echo "$maps" >&2
  fail "sourcemaps found in $DIST; they are uploaded to Sentry, never published"
fi

# AC7 — a secret that reached the bundle is already public. Compare on a prefix so this
# script never has to echo a whole credential to fail.
check_secret_absent() {
  local name=$1 value=${2:-}
  [ -n "$value" ] || return 0
  local prefix=${value:0:8}
  if grep -rqF "$prefix" "$DIST"; then
    fail "$name appears in the built bundle"
  fi
}
check_secret_absent SUPABASE_ACCESS_TOKEN "${SUPABASE_ACCESS_TOKEN:-}"
check_secret_absent SENTRY_AUTH_TOKEN "${SENTRY_AUTH_TOKEN:-}"
check_secret_absent SUPABASE_SERVICE_ROLE_KEY "${SUPABASE_SERVICE_ROLE_KEY:-}"

# AC9 — only meaningful once the custom domain is live. public/CNAME is absent until the
# DNS for app.phibsborofc.com points at Pages; see docs/deployment.md.
if [ -f public/CNAME ]; then
  [ -f "$DIST/CNAME" ] || fail "public/CNAME exists but $DIST/CNAME does not"
  expected=$(tr -d '[:space:]' < public/CNAME)
  actual=$(tr -d '[:space:]' < "$DIST/CNAME")
  [ "$expected" = "$actual" ] || fail "$DIST/CNAME is '$actual', expected '$expected'"
  echo "verify-dist: CNAME present and correct ($actual)"
else
  echo "verify-dist: no public/CNAME yet — publishing to the Pages project page (S0.5 deviation)"
fi

[ -f "$DIST/index.html" ] || fail "$DIST/index.html is missing"
grep -q 'name="pfc-release"' "$DIST/index.html" || fail "the pfc-release meta tag is missing from index.html"

echo "verify-dist: clean"
