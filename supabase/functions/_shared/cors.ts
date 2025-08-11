// supabase/functions/_shared/cors.ts

// Define standard CORS headers to be used by all functions.
// This allows requests from any origin and specifies which headers
// the client is allowed to send. It's crucial for browser security.
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Max-Age': '86400', // Cache preflight response for 24 hours
};