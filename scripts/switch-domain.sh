#!/usr/bin/env bash
# Cuts the site over from the GitHub Pages project page to app.phibsboro.ie.
# Run it only once `app.phibsboro.ie` resolves — it checks, and refuses if not.
#
#   ./scripts/switch-domain.sh
#
# Reversible: delete public/CNAME, set VITE_BASE_PATH back to /phibsboro/ and
# VITE_APP_BASE_URL back to the github.io address, and re-run the deploy.

set -euo pipefail
cd "$(dirname "$0")/.."

DOMAIN=app.phibsboro.ie
TARGET=chris-88.github.io
REPO=chris-88/phibsboro

# Ask a public resolver, not the local one: the machine that ran the watcher may have the
# old NXDOMAIN negatively cached, and GitHub verifies against public DNS anyway.
resolve_cname() {
  curl -s -H 'accept: application/dns-json' "https://dns.google/resolve?name=$1&type=CNAME" \
    | python3 -c 'import sys,json;print(" ".join(a["data"] for a in json.load(sys.stdin).get("Answer",[])))'
}

echo "Checking DNS for $DOMAIN (via dns.google) ..."
cname=$(resolve_cname "$DOMAIN")
if [ -z "$cname" ]; then
  cat >&2 <<MSG
$DOMAIN does not resolve yet.

Add this record in the Letshost control panel (Zone Editor for phibsboro.ie):

    Type   CNAME
    Name   app
    Value  $TARGET
    TTL    3600

It does not affect the website at the phibsboro.ie apex. DNS usually propagates
in minutes; .ie can take up to an hour. Re-run this script once it resolves.
MSG
  exit 1
fi
echo "  $DOMAIN → $cname"

echo "Writing public/CNAME ..."
mkdir -p public
printf '%s\n' "$DOMAIN" > public/CNAME

echo "Pointing the build at the apex ..."
gh variable set VITE_BASE_PATH   --repo "$REPO" --body '/'
gh variable set VITE_APP_BASE_URL --repo "$REPO" --body "https://$DOMAIN"

echo "Telling GitHub Pages about the custom domain ..."
gh api -X PUT "repos/$REPO/pages" -f "cname=$DOMAIN" -F "https_enforced=true" >/dev/null 2>&1 \
  || echo "  (Pages API declined — set the domain in Settings > Pages by hand)"

cat <<MSG

Done locally. Now:
  git add public/CNAME && git commit -m 'ci: serve from app.phibsboro.ie' && git push

The deploy workflow republishes with the new base path. GitHub issues the TLS
certificate a few minutes after the domain is verified; until it does, the site
may briefly show a certificate warning. That is expected and clears itself.

Then confirm:
  curl -sI https://$DOMAIN | head -1
MSG
