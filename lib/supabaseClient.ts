import { createClient } from '@supabase/supabase-js';

// Helper to check multiple possible environment variable locations
const getEnvVar = (key: string): string | undefined => {
  // 1. Check Vite standard (import.meta.env)
  if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
    const val = (import.meta as any).env[key];
    if (val) return val;
  }
  
  // 2. Check Node/Process standard (process.env) - common in Vercel/CRA
  if (typeof process !== 'undefined' && process.env) {
    const val = process.env[key];
    if (val) return val;
  }
  
  return undefined;
};

// Search for URL in priority order
const SUPABASE_URL = 
  getEnvVar('VITE_SUPABASE_URL') || 
  getEnvVar('REACT_APP_SUPABASE_URL') || 
  getEnvVar('SUPABASE_URL');

// Search for Key in priority order, including the user's mentioned "API_KEY"
const SUPABASE_ANON_KEY = 
  getEnvVar('VITE_SUPABASE_ANON_KEY') || 
  getEnvVar('REACT_APP_SUPABASE_ANON_KEY') || 
  getEnvVar('SUPABASE_ANON_KEY') || 
  getEnvVar('SUPABASE_KEY') || 
  getEnvVar('API_KEY');

// Debugging: Check if keys are loaded
console.log("Supabase Client Init:", { 
  hasUrl: !!SUPABASE_URL, 
  urlCheck: SUPABASE_URL ? (SUPABASE_URL.substring(0, 15) + "...") : "MISSING",
  hasKey: !!SUPABASE_ANON_KEY
});

// Export the client
// If keys are missing, we create a client that points to a dummy URL. 
// App.tsx will catch the connection error and show a "Setup Required" screen.
export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co', 
  SUPABASE_ANON_KEY || 'placeholder'
);