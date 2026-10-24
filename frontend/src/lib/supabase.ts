import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The Supabase client.
 *
 * Everything the restaurant reads (menu, reviews, a customer's own orders) and
 * everything it writes (signup, signin, newsletter) goes through here, guarded
 * by row level security. Money decisions live in Postgres functions; the two
 * operations that need secrets (Razorpay, transactional email) run in Edge
 * Functions and are called with `supabase.functions.invoke`.
 *
 * Configure with:
 *   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
 *   VITE_SUPABASE_ANON_KEY=<anon key>
 */

const url = (import.meta.env.VITE_SUPABASE_URL ?? "").trim();
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();

/** True when this build points at a Supabase project. */
export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // the site is a single-page app with no OAuth redirect to detect
        detectSessionInUrl: false,
        storageKey: "khang_supabase_auth",
      },
      global: { headers: { "x-client-info": "khang-web" } },
    })
  : null;

/** The client, or a clear error when the build has no Supabase project. */
export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see supabase/README.md).",
    );
  }
  return supabase;
}

/** The project URL — the Edge Functions are addressed relative to it. */
export const supabaseUrl = url;
