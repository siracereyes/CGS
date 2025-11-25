import { createClient } from '@supabase/supabase-js';

// Use Environment Variables (Vite standard) safely
const env = (import.meta as any).env || {};

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY;

// Debugging: Check if keys are loaded (Will show in Browser Console)
console.log("Supabase Client Init:", { 
  hasUrl: !!SUPABASE_URL, 
  urlCheck: SUPABASE_URL ? (SUPABASE_URL.substring(0, 15) + "...") : "MISSING"
});

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("CRITICAL ERROR: Supabase Keys are missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your Vercel Environment Variables.");
}

// Create client only if keys exist to prevent immediate crash, otherwise create a dummy client that will fail gracefully
export const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY) 
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : createClient('https://placeholder.supabase.co', 'placeholder');