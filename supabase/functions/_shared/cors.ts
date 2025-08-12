// supabase/functions/_shared/cors.ts

// Define standard CORS headers to be used by all functions.
// Centralized dynamic CORS helper for all Edge Functions.
// Uses ALLOWED_ORIGIN env var; falls back to '*'. Adds Vary: Origin for caches.
// Methods can be extended per-function; default common superset.
// deno-lint-ignore no-explicit-any
declare const Deno: any;

export function buildCorsHeaders(extra: Partial<Record<string,string>> = {}) {
  const origin = (Deno?.env?.get('ALLOWED_ORIGIN') || '*').trim() || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST,GET,OPTIONS',
    'Access-Control-Max-Age': '86400',
    ...extra
  };
}

export const corsHeaders = buildCorsHeaders();