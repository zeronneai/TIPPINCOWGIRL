// ---------------------------------------------------------------------------
// The staff portal's Supabase client, in the browser.
//
// It holds the PUBLIC anon key only. Everything it can read or change is
// decided by Row Level Security in supabase/schema.sql: a signed in user who
// is not in `staff` sees nothing, and nobody can insert or delete an order
// from here. The service role key is server only (api/_lib/orders.js) and
// must never get a VITE_ prefix.
//
//   VITE_SUPABASE_URL       https://<project>.supabase.co
//   VITE_SUPABASE_ANON_KEY  Project Settings > API > anon public
// ---------------------------------------------------------------------------

import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** null when the two build time variables are missing. */
export const supabase = url && anonKey ? createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } }) : null;
