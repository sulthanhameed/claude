/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL — https://<ref>.supabase.co */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase anon (public) key. Safe in the browser: RLS is the gate. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Local preview only: REST base for the mock API when Supabase is unset. */
  readonly VITE_PREVIEW_API?: string;
  /** Dev server proxy target for that mock. */
  readonly VITE_PROXY_TARGET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
