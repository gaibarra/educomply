#!/usr/bin/env bash
set -euo pipefail

# Deploy Supabase Edge Functions and set required secrets.
# Prereqs: supabase CLI installed and authenticated (supabase login), env vars exported.

REQ_VARS=("SUPABASE_PROJECT_REF" "ALLOWED_ORIGIN" "GEMINI_API_KEY")
for v in "${REQ_VARS[@]}"; do
  if [[ -z "${!v:-}" ]]; then
    echo "[deploy_functions] ERROR: Missing env var $v" >&2
    exit 1
  fi
done

if ! command -v supabase >/dev/null 2>&1; then
  echo "[deploy_functions] ERROR: supabase CLI not found. Install from https://supabase.com/docs/guides/cli" >&2
  exit 1
fi

echo "[deploy_functions] Setting secrets on project ${SUPABASE_PROJECT_REF}..."
 supabase functions secrets set \
  --project-ref "$SUPABASE_PROJECT_REF" \
  ALLOWED_ORIGIN="$ALLOWED_ORIGIN" \
  GEMINI_API_KEY="$GEMINI_API_KEY"

echo "[deploy_functions] Deploying functions..."
 supabase functions deploy suggest-subtasks --project-ref "$SUPABASE_PROJECT_REF"
 supabase functions deploy analyze-compliance --project-ref "$SUPABASE_PROJECT_REF"
 supabase functions deploy generate-report --project-ref "$SUPABASE_PROJECT_REF"

# Optional: quick health check
 echo "[deploy_functions] Healthcheck suggest-subtasks:"
 curl -sS "https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1/suggest-subtasks?health=1" -H "Origin: ${ALLOWED_ORIGIN%%,*}" -i | sed -n '1,15p'
