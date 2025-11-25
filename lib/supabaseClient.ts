import { createClient } from '@supabase/supabase-js';

// Use Environment Variables (Vite standard) safely
const env = (import.meta as any).env || {};

const SUPABASE_URL = env.VITE_SUPABASE_URL || 'https://zaxqfwirprqutexzfkuh.supabase.co';
const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpheHFmd2lycHJxdXRleHpma3VoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5MTM4MDQsImV4cCI6MjA3OTQ4OTgwNH0.mv4p_FdnhkBdtY3mE1WSt8Q0_J8Vb-r1mj5NxUvQdXI';

// Debugging: Check if keys are loaded (Will show in Browser Console)
console.log("Supabase Client Init:", { 
  hasUrl: !!SUPABASE_URL, 
  urlCheck: SUPABASE_URL.substring(0, 15) + "..." 
});

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("CRITICAL ERROR: Supabase Keys are missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your Vercel Environment Variables.");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);