import { createClient } from '@supabase/supabase-js';

// Use Environment Variables (Vite standard) safely
// We access import.meta.env safely to avoid crashes if it's undefined in certain environments
const env = (import.meta as any).env || {};

const SUPABASE_URL = env.VITE_SUPABASE_URL || 'https://zaxqfwirprqutexzfkuh.supabase.co';
const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpheHFmd2lycHJxdXRleHpma3VoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5MTM4MDQsImV4cCI6MjA3OTQ4OTgwNH0.mv4p_FdnhkBdtY3mE1WSt8Q0_J8Vb-r1mj5NxUvQdXI';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);