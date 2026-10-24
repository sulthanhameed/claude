/** Supabase clients + caller verification, shared by the Edge Functions. */
import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/** Full access, bypasses RLS. Never expose this key to the browser. */
export function serviceClient(): SupabaseClient {
  return createClient(URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * The caller, as proven by the Authorization header supabase-js sends with
 * functions.invoke(). Returns null when the request is anonymous or the token
 * is stale.
 */
export async function caller(req: Request): Promise<User | null> {
  const header = req.headers.get("Authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const client = createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // getUser(token) verifies the JWT with the auth server — a forged or
  // expired token resolves to an error, not a user.
  const { data, error } = await client.auth.getUser(token);
  if (error) return null;
  return data.user ?? null;
}
