import { createClient } from '@supabase/supabase-js';
import { Database } from '../types';

// NOTE: These are placeholder values. The actual Supabase URL and Key
// should be provided through a secure environment configuration.
const supabaseUrl = 'https://raiccyhtjhsgmouzulhn.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhaWNjeWh0amhzZ21vdXp1bGhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ3NjgwNzAsImV4cCI6MjA3MDM0NDA3MH0.8mve163z9sL-wvJlCkiRihpaHOerVIywjd6V_5xcWCU';

// This is a check to remind you to update the credentials if running locally.
if (supabaseUrl.includes('placeholder')) {
    const message = `
    *********************************************************************************
    *                          --- ACTION REQUIRED ---                              *
    *                                                                               *
    *    Please update supabaseUrl and supabaseAnonKey in 'services/supabaseClient.ts'     *
    *    with your project's credentials from your Supabase dashboard.              *
    *                                                                               *
    *********************************************************************************
  `;
    // Using a console.warn so it's visible but doesn't block execution.
    // The app will fail to connect to Supabase until this is done.
    console.warn(message);
}


// Nota: La opción { functions: { url } } no está tipada en la versión actual de supabase-js; mantenemos cliente estándar.
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);