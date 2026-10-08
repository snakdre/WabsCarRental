import { createClient } from "@supabase/supabase-js";

// Anonymous, cookie-less client for public reads that can safely be cached
// by Next.js data cache (unstable_cache). Do NOT use for anything user-scoped
// or RLS-dependent beyond the anon key's permissions.
export function createPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}
