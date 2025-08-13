import { createClient } from '@supabase/supabase-js';
import { Database } from '../types';

// Credenciales leídas desde variables de entorno (Vite las expone con prefijo VITE_)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[supabaseClient] Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Añádelas en tu archivo .env');
}

// Create Supabase client with safer auth defaults in the browser
export const supabase = createClient<Database>(
  supabaseUrl || '',
  supabaseAnonKey || '',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
  storageKey: 'educomply-auth',
      // Use localStorage in browser; fall back to default in tests/SSR
      storage: typeof window !== 'undefined' ? window.localStorage : undefined as any,
    },
  }
);

// Proactively clear broken sessions that can cause "Invalid Refresh Token" noise
if (typeof window !== 'undefined') {
  (async () => {
    try {
      const { error } = await supabase.auth.getSession();
      if (error && /invalid\s*refresh\s*token/i.test(error.message)) {
        await supabase.auth.signOut();
      }
    } catch (e: any) {
      if (e?.message && /invalid\s*refresh\s*token/i.test(e.message)) {
        try { await supabase.auth.signOut(); } catch { /* ignore */ }
      }
    }
  })();
}