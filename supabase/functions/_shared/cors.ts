// supabase/functions/_shared/cors.ts

// Define standard CORS headers to be used by all functions.
// Centralized dynamic CORS helper for all Edge Functions.
// Uses ALLOWED_ORIGIN env var; falls back to '*'. Adds Vary: Origin for caches.
// Methods can be extended per-function; default common superset.
// deno-lint-ignore no-explicit-any
declare const Deno: any;

export function buildCorsHeaders(extra: Partial<Record<string,string>> = {}) {
  // Support both Deno (Edge Functions) and Node (tests) env sources.
  // In Vitest we purposely ignore any Deno polyfill value so tests can delete process.env.ALLOWED_ORIGIN
  // to assert wildcard behaviour. Some environments may expose a Deno.env shim that still contains
  // the OS-level variable even after process.env deletion, so we gate on VITEST flag.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const denoEnv: any = (typeof Deno !== 'undefined' && Deno.env?.get) ? Deno.env : null;
  const isVitest = !!(typeof process !== 'undefined' && (process as any).env && (process as any).env.VITEST);
  const nodeVal = (typeof process !== 'undefined' && (process as any)?.env) ? (process as any).env.ALLOWED_ORIGIN : undefined;
  const raw = (isVitest ? (nodeVal ?? '*') : (nodeVal ?? denoEnv?.get('ALLOWED_ORIGIN') ?? '*')).toString();
  const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
  const containsWildcard = parts.includes('*');
  const allowOrigin = containsWildcard ? '*' : (parts[0] || '*');
  const base: Record<string,string> = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, Authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST,GET,OPTIONS',
    'Access-Control-Max-Age': '86400',
    ...extra
  };
  if (allowOrigin !== '*') {
    base['Access-Control-Allow-Credentials'] = 'true';
  }
  return base;
}

export const corsHeaders = buildCorsHeaders();

export function buildCorsHeadersForRequest(req: Request, extra: Partial<Record<string,string>> = {}) {
  // Lee lista de orígenes permitidos (coma) ej: http://localhost:5173,https://app.prod.com
  // Si incluye '*', se permitirá cualquiera (pero sin credenciales). Preferimos eco específico cuando posible.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const denoEnv: any = (typeof Deno !== 'undefined' && Deno.env?.get) ? Deno.env : null;
  const isVitest = !!(typeof process !== 'undefined' && (process as any).env && (process as any).env.VITEST);
  const nodeVal = (typeof process !== 'undefined' && (process as any)?.env) ? (process as any).env.ALLOWED_ORIGIN : undefined;
  const allowedRaw = (isVitest ? (nodeVal ?? '*') : (nodeVal ?? denoEnv?.get('ALLOWED_ORIGIN') ?? '*')).toString();
  const allowList = allowedRaw.split(',').map(o => o.trim()).filter(Boolean);
  const reqOrigin = req.headers.get('origin') || '';
  const wildcard = allowList.includes('*');
  let isAllowed = wildcard || allowList.includes(reqOrigin);
  // Permitir cualquier puerto localhost si algún origen localhost está en la lista (facilita desarrollo cuando Vite cambia de puerto)
  if (!isAllowed && reqOrigin.startsWith('http://localhost')) {
    const anyLocalhost = allowList.some(o => o.startsWith('http://localhost'));
    if (anyLocalhost) {
      isAllowed = true;
    }
  }
  const allowOrigin = isAllowed ? (wildcard ? (reqOrigin || '*') : reqOrigin) : allowList[0] || 'http://localhost:5173';
  const requestedHeaders = req.headers.get('access-control-request-headers');
  const requestedMethod = req.headers.get('access-control-request-method');
  const base = buildCorsHeaders({
    'Access-Control-Allow-Origin': allowOrigin,
    ...(requestedHeaders ? { 'Access-Control-Allow-Headers': requestedHeaders } : {}),
    ...(requestedMethod ? { 'Access-Control-Allow-Methods': requestedMethod + ',OPTIONS' } : {}),
  });
  // Si el origen no estaba permitido, indicamos explicitamente para debug
  if (!isAllowed) {
    base['X-CORS-Denied-Origin'] = reqOrigin || 'unknown';
  }
  return { ...base, ...extra };
}