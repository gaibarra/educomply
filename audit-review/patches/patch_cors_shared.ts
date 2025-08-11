// supabase/functions/_shared/cors.ts (reemplazo sugerido)
export const corsHeaders = (() => {
  const allowed = Deno.env.get('ALLOWED_ORIGIN') || '';
  const origin = allowed || '*'; // en producción configure ALLOWED_ORIGIN
  return {
    'Access-Control-Allow-Origin': origin,
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Max-Age': '86400'
  };
})();
