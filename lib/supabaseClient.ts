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

// Check Local Storage for overrides (Manual Setup Mode)
const getStoredVar = (key: string): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(key);
  }
  return null;
};

// Search for URL in priority order: LocalStorage -> Vite Env -> Process Env
const SUPABASE_URL = 
  getStoredVar('VITE_SUPABASE_URL') ||
  getEnvVar('VITE_SUPABASE_URL') || 
  getEnvVar('REACT_APP_SUPABASE_URL') || 
  getEnvVar('SUPABASE_URL');

// Search for Key in priority order
const SUPABASE_ANON_KEY = 
  getStoredVar('VITE_SUPABASE_ANON_KEY') ||
  getEnvVar('VITE_SUPABASE_ANON_KEY') || 
  getEnvVar('REACT_APP_SUPABASE_ANON_KEY') || 
  getEnvVar('SUPABASE_ANON_KEY') || 
  getEnvVar('SUPABASE_KEY') || 
  getEnvVar('API_KEY');

// Debugging: Check if keys are loaded
console.log("Supabase Client Init:", { 
  hasUrl: !!SUPABASE_URL, 
  urlCheck: SUPABASE_URL ? (SUPABASE_URL.substring(0, 8) + "..." + SUPABASE_URL.slice(-3)) : "MISSING",
  hasKey: !!SUPABASE_ANON_KEY,
  source: getStoredVar('VITE_SUPABASE_URL') ? 'LocalStorage' : 'EnvVar'
});

// Custom Fetch with Retry Logic to handle Vercel/Edge network blips
const fetchWithRetry = async (url: RequestInfo | URL, options?: RequestInit): Promise<Response> => {
  const MAX_RETRIES = 3;
  let attempt = 0;
  
  while (true) {
    try {
      return await fetch(url, options);
    } catch (error) {
      attempt++;
      console.warn(`Supabase fetch failed (attempt ${attempt}/${MAX_RETRIES}):`, error);
      
      if (attempt >= MAX_RETRIES) {
        throw error;
      }
      
      // Exponential backoff: 500ms, 1000ms, 2000ms
      const delay = 500 * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// Determine if configured (not using placeholders)
export const isConfigured = 
  !!SUPABASE_URL && 
  !SUPABASE_URL.includes('placeholder') && 
  !!SUPABASE_ANON_KEY && 
  !SUPABASE_ANON_KEY.includes('placeholder');

// Helper to save config manually from UI
export const saveSupabaseConfig = (url: string, key: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('VITE_SUPABASE_URL', url.trim());
    localStorage.setItem('VITE_SUPABASE_ANON_KEY', key.trim());
    window.location.reload(); // Reload to re-initialize client
  }
};

export const clearSupabaseConfig = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('VITE_SUPABASE_URL');
    localStorage.removeItem('VITE_SUPABASE_ANON_KEY');
    window.location.reload();
  }
};

// Export the client
export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co', 
  SUPABASE_ANON_KEY || 'placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    },
    global: {
      fetch: fetchWithRetry
    }
  }
);