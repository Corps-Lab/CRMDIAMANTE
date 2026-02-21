import { createClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://vrijkozdsituzznxhttx.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZyaWprb3pkc2l0dXp6bnhodHR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MDQ2NTIsImV4cCI6MjA4NzE4MDY1Mn0.P2G_3btpVNgGQIKiJehkWcFFg1z9UAYbKg9Jb9c1nRg";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || DEFAULT_SUPABASE_URL;
const supabaseAnonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || DEFAULT_SUPABASE_ANON_KEY;

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn("VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY ausentes. Usando configuracao padrao do CRM DIAMANTE.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export const edgeOptions = {
  supabaseUrl,
  anonKey: supabaseAnonKey,
  edgeBaseUrl: (import.meta.env.VITE_EDGE_FUNCTIONS_BASE_URL as string | undefined)?.trim() || undefined,
};
