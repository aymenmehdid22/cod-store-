import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Anonymous, session-less client for public storefront reads. Row Level Security
// guarantees it only ever sees active products, visible content and public settings.
let cached: SupabaseClient | null = null;
export function getPublicSupabase(): SupabaseClient {
  if (cached) return cached;
  cached = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
