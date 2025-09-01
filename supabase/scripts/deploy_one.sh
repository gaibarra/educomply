#!/usr/bin/env bash
set -euo pipefail
FN=${1:-}
if [[ -z "$FN" ]]; then echo "Usage: deploy_one.sh <function-name>" >&2; exit 1; fi
if ! command -v supabase >/dev/null 2>&1; then echo "Need supabase CLI" >&2; exit 1; fi
supabase functions deploy "$FN"

echo "Deployed $FN"
