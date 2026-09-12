#!/usr/bin/env bash
# One-time credential handover. Run it, answer the prompts, and both the local dev
# environment and the GitHub repo are configured.
#
#   ./scripts/setup-credentials.sh
#
# Secrets are read with the terminal echo off, written to .env.local (gitignored) and
# pushed to GitHub with `gh secret set`. Nothing is printed and nothing is committed.
# Press Enter to skip any value you do not have yet; re-run the script later to fill it in.

set -uo pipefail
cd "$(dirname "$0")/.."

REPO=chris-88/phibsboro
ENV_FILE=.env.local

command -v gh >/dev/null || { echo "gh is not installed" >&2; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "gh is not authenticated — run: gh auth login" >&2; exit 1; }

say() { printf '\n\033[1m%s\033[0m\n' "$1"; }
note() { printf '  %s\n' "$1"; }

# ask_secret VAR "prompt" "where to find it"
ask_secret() {
  local var=$1 prompt=$2 where=$3 value
  say "$prompt"
  note "$where"
  printf '  value (hidden, Enter to skip): '
  read -rs value
  printf '\n'
  if [ -z "$value" ]; then
    note "skipped"
    return 1
  fi
  printf '%s' "$value" | gh secret set "$var" --repo "$REPO" >/dev/null \
    && note "→ repo secret $var set"
  printf '%s=%s\n' "$var" "$value" >> "$ENV_FILE"
  note "→ written to $ENV_FILE"
  return 0
}

# ask_public VAR "prompt" "where to find it"
ask_public() {
  local var=$1 prompt=$2 where=$3 value
  say "$prompt"
  note "$where"
  printf '  value (Enter to skip): '
  read -r value
  if [ -z "$value" ]; then
    note "skipped"
    return 1
  fi
  gh variable set "$var" --repo "$REPO" --body "$value" >/dev/null \
    && note "→ repo variable $var set"
  printf '%s=%s\n' "$var" "$value" >> "$ENV_FILE"
  note "→ written to $ENV_FILE"
  return 0
}

printf '\033[1mPhibsboro FC — credential setup\033[0m\n'
printf 'Repo: %s\n' "$REPO"
printf 'Local file: %s (gitignored, never committed)\n' "$ENV_FILE"

if [ -f "$ENV_FILE" ]; then
  printf '\n%s already exists. Values you enter are appended; the last one wins.\n' "$ENV_FILE"
fi
printf '# Written by scripts/setup-credentials.sh. Never commit this file.\n' >> "$ENV_FILE"
chmod 600 "$ENV_FILE"

# --- Supabase, the production project -----------------------------------------
ask_public VITE_SUPABASE_ANON_KEY \
  'Supabase anon key (public — ships in the browser bundle)' \
  'Dashboard → Project Settings → API Keys → anon / publishable'

ask_secret SUPABASE_SERVICE_ROLE_KEY \
  'Supabase service-role key (SECRET — full database access, bypasses RLS)' \
  'Dashboard → Project Settings → API Keys → service_role. Needed by the S1.4 RLS test suite.'

ask_secret SUPABASE_ACCESS_TOKEN \
  'Supabase personal access token (SECRET — lets CI apply migrations)' \
  'https://supabase.com/dashboard/account/tokens → Generate new token'

gh secret set SUPABASE_PROJECT_REF --repo "$REPO" --body hhhlbermhelfgxgkgitz >/dev/null \
  && say 'Supabase project ref' && note '→ repo secret SUPABASE_PROJECT_REF set to hhhlbermhelfgxgkgitz'

# --- Sentry, optional ---------------------------------------------------------
say 'Sentry is optional — skip all four if you have not set it up.'
note 'S0.6 skips initialisation on a blank DSN, so nothing breaks without it.'
ask_public VITE_SENTRY_DSN 'Sentry DSN (public)' 'Sentry → Settings → Projects → Client Keys (DSN)'
ask_public SENTRY_ORG 'Sentry org slug' 'The org part of your Sentry URL'
ask_public SENTRY_PROJECT 'Sentry project slug' 'The project part of your Sentry URL'
ask_secret SENTRY_AUTH_TOKEN 'Sentry auth token (SECRET — sourcemap upload only)' \
  'Sentry → Settings → Auth Tokens → Create. Scope: project:releases'

# --- Report -------------------------------------------------------------------
say 'Repo variables now set'
gh variable list --repo "$REPO" 2>/dev/null | sed 's/^/  /'
say 'Repo secrets now set (names only — values are write-only)'
gh secret list --repo "$REPO" 2>/dev/null | sed 's/^/  /'

say 'Done'
note "Local values are in $ENV_FILE. Tell Claude it has been run."
