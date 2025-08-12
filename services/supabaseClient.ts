import { createClient } from '@supabase/supabase-js';
import { Database } from '../types';

// Credenciales leídas desde variables de entorno (Vite las expone con prefijo VITE_)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[supabaseClient] Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Añádelas en tu archivo .env');
}

export const supabase = createClient<Database>(supabaseUrl || '', supabaseAnonKey || '');