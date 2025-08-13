// Ambient declaration to satisfy TS in local dev for Deno npm specifier used in Edge Function.
declare module 'npm:@google/generative-ai' {
  export * from '@google/generative-ai';
}

// Ambient declaration to satisfy TS in local dev for Deno npm specifier of supabase-js used in Edge Functions.
declare module 'npm:@supabase/supabase-js' {
  export * from '@supabase/supabase-js';
}

// Ambient declaration for Deno npm:zod used in Edge Function handler.
declare module 'npm:zod' {
  export * from 'zod';
}
