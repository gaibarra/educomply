// supabase/functions/_shared/cors.ts

// Define standard CORS headers to be used by all functions.
// Centralized dynamic CORS helper for all Edge Functions.
// Uses ALLOWED_ORIGIN env var; falls back to '*'. Adds Vary: Origin for caches.
// Methods can be extended per-function; default common superset.
// deno-lint-ignore no-explicit-any
declare const Deno: any;

export function buildCorsHeaders(extra: Partial<Record<string,string>> = {}) {
  // Support both Deno (Edge Functions) and Node (tests) env sources.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const denoEnv: any = (typeof Deno !== 'undefined' && Deno.env?.get) ? Deno.env : null;
  const allowedRaw = (denoEnv?.get('ALLOWED_ORIGIN') || process?.env?.ALLOWED_ORIGIN || '*').toString();
  let allowOrigin = '*';
  if (allowedRaw && allowedRaw !== '*') {
    const parts = allowedRaw.split(',').map(s => s.trim()).filter(Boolean);
    allowOrigin = parts.length <= 1 ? (parts[0] || '*') : parts[0]; // never output comma-separated values
  }
  return {
    'Access-Control-Allow-Origin': allowOrigin || '*',
    'Vary': 'Origin',
    // Include both lowercase & capitalized Authorization to avoid strict checks in some gateways
    'Access-Control-Allow-Headers': 'authorization, Authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST,GET,OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
    ...extra
  };
}

export const corsHeaders = buildCorsHeaders();

// Build CORS headers per-request, echoing the Origin if it matches allowed list.
export function buildCorsHeadersForRequest(req: Request, extra: Partial<Record<string,string>> = {}) {
  // deno-lint-ignore no-explicit-any
  const denoEnv: any = (typeof Deno !== 'undefined' && (Deno as any).env?.get) ? (Deno as any).env : null;
  const allowedRaw = (denoEnv?.get('ALLOWED_ORIGIN') || (globalThis as any)?.process?.env?.ALLOWED_ORIGIN || '*').toString();
  const requestOrigin = req.headers.get('origin') || '';
  // Prefer echoing the request Origin if present. Fallback to allowedRaw or '*'.
  let allowOrigin = requestOrigin || (allowedRaw === '*' ? '*' : (allowedRaw.split(',').map(s => s.trim()).filter(Boolean)[0] || '*'));
  // Reflect requested headers/method for strict gateways
  const requestedHeaders = req.headers.get('access-control-request-headers');
  const requestedMethod = req.headers.get('access-control-request-method');
  const base = buildCorsHeaders({
    'Access-Control-Allow-Origin': allowOrigin,
    ...(requestedHeaders ? { 'Access-Control-Allow-Headers': requestedHeaders } : {}),
    ...(requestedMethod ? { 'Access-Control-Allow-Methods': requestedMethod + ',OPTIONS' } : {}),
  });
  return { ...base, ...extra };
}