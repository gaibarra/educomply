// supabase/functions/_shared/cors.ts (reemplazo sugerido)
// Shim para TypeScript fuera de Deno y fallback a process.env en Node/Vite
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;

export const corsHeaders = (() => {
  const denoAllowed = (typeof Deno !== 'undefined' && Deno?.env?.get) ? Deno.env.get('ALLOWED_ORIGIN') : '';
  const nodeAllowed = (typeof process !== 'undefined' && (process as any)?.env) ? (process as any).env.ALLOWED_ORIGIN : '';
  const allowed = denoAllowed || nodeAllowed || '';
  const origin = allowed || '*'; // en producción configure ALLOWED_ORIGIN
  return {
    'Access-Control-Allow-Origin': origin,
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Max-Age': '86400'
  };
})();
