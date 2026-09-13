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
# DNS for app.phibsboro.ie points at Pages; see docs/deployment.md.
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

# S0.3 AC7 — Pages serves 404.html for a link that lost its `#`; it must carry the real base,
# not the unsubstituted placeholder.
[ -f "$DIST/404.html" ] || fail "$DIST/404.html is missing"
grep -q '%BASE_URL%' "$DIST/404.html" && fail "404.html still contains the %BASE_URL% placeholder"

# S0.3 AC12 — the manager and admin screens are lazy chunks index.html never references.
lazy=0
for chunk in "$DIST"/assets/*.js; do
  grep -qF "$(basename "$chunk")" "$DIST/index.html" || lazy=$((lazy + 1))
done
[ "$lazy" -ge 2 ] || fail "expected at least two lazily loaded chunks, found $lazy"
echo "verify-dist: $lazy lazy chunks"

# S0.4 — the PWA surface, checked against whatever base this build was made with. The base
# is read back from the manifest link the plugin injected, so the same check holds at `/`
# on the custom domain and at `/phibsboro/` on the project page.
[ -f "$DIST/manifest.webmanifest" ] || fail "$DIST/manifest.webmanifest is missing"
[ -f "$DIST/sw.js" ] || fail "$DIST/sw.js is missing"
base=$(grep -o 'rel="manifest" href="[^"]*manifest.webmanifest"' "$DIST/index.html" \
  | sed -E 's/.*href="(.*)manifest.webmanifest"/\1/')
[ -n "$base" ] || fail "index.html carries no <link rel=\"manifest\">"
DIST="$DIST" BASE="$base" node - <<'JS'
const fs = require('node:fs')
const { DIST, BASE } = process.env
const fail = (m) => { console.error(`verify-dist: ${m}`); process.exit(1) }
const m = JSON.parse(fs.readFileSync(`${DIST}/manifest.webmanifest`, 'utf8'))
for (const k of ['id', 'start_url', 'scope']) if (m[k] !== BASE) fail(`manifest ${k} is '${m[k]}', expected '${BASE}'`)
if (m.display !== 'standalone') fail(`manifest display is '${m.display}'`)
const purposes = new Set(m.icons.map((i) => i.purpose))
if (!purposes.has('any') || !purposes.has('maskable')) fail('manifest needs both an any and a maskable icon')
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const check = (src, sizes) => {
  if (!src.startsWith(BASE)) fail(`icon ${src} is not under the base ${BASE}`)
  const file = `${DIST}/${src.slice(BASE.length)}`
  if (!fs.existsSync(file)) fail(`icon ${src} named in the manifest is not in ${DIST}`)
  const b = fs.readFileSync(file)
  if (!b.subarray(0, 8).equals(png)) fail(`${file} is not a PNG`)
  const [w, h] = sizes.split('x').map(Number)
  if (b.readUInt32BE(16) !== w || b.readUInt32BE(20) !== h) fail(`${file} is not ${sizes}`)
}
for (const i of m.icons) check(i.src, i.sizes)
const html = fs.readFileSync(`${DIST}/index.html`, 'utf8')
const touch = /rel="apple-touch-icon"[^>]*href="([^"]+)"/.exec(html)?.[1]
if (!touch) fail('index.html carries no apple-touch-icon link')
check(touch, '180x180')
if (!/name="apple-mobile-web-app-capable" content="yes"/.test(html)) fail('apple-mobile-web-app-capable is missing')
const theme = /name="theme-color" content="([^"]+)"/.exec(html)?.[1]
if (theme?.toLowerCase() !== m.theme_color.toLowerCase()) fail(`theme-color meta '${theme}' != manifest '${m.theme_color}'`)
console.log(`verify-dist: manifest, service worker and ${m.icons.length + 1} icons present under base '${BASE}'`)
JS

echo "verify-dist: clean"
