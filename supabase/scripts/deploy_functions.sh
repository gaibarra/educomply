#!/usr/bin/env bash
set -euo pipefail

# Deploy Supabase Edge Functions and set required secrets.
# Prereqs: supabase CLI installed and authenticated (supabase login), env vars exported.

REQ_VARS=("SUPABASE_PROJECT_REF" "ALLOWED_ORIGIN" "GEMINI_API_KEY" "SUPABASE_SERVICE_ROLE_KEY")
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

echo "[deploy_functions] Setting secrets on project (ensure 'supabase link' already done for $SUPABASE_PROJECT_REF)..."
supabase functions secrets set \
  ALLOWED_ORIGIN="$ALLOWED_ORIGIN" \
  GEMINI_API_KEY="$GEMINI_API_KEY" \
  SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY"

# List of all edge functions (folder names in supabase/functions)
FUNCTIONS=( \
  suggest-subtasks \
  analyze-compliance \
  generate-report \
  admin-create-user \
  generate-audit-activities \
  generate-document \
  generate-sub-activities \
  suggest-audit-plan \
  task-history-recommendation \
  tasks-crud \
)

echo "[deploy_functions] Deploying ${#FUNCTIONS[@]} functions..."
for fn in "${FUNCTIONS[@]}"; do
  echo "[deploy_functions] -> $fn"
  supabase functions deploy "$fn"
done

echo "[deploy_functions] Running health checks (best-effort)..."
health_urls=( \
  "suggest-subtasks?health=1" \
  "generate-report" \
  "analyze-compliance" \
)
for path in "${health_urls[@]}"; do
  echo "[deploy_functions] Health: $path"
  curl -sS "https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1/${path}" -H "Origin: ${ALLOWED_ORIGIN%%,*}" -i | sed -n '1,12p' || true
done

echo "[deploy_functions] Done."
