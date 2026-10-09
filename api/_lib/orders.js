// ---------------------------------------------------------------------------
// Server side access to the staff portal's database (Supabase).
//
// SERVER ONLY. This uses the SERVICE ROLE key, which bypasses Row Level
// Security, so it must never reach the browser: it is read from
// SUPABASE_SERVICE_ROLE_KEY (no VITE_ prefix, so Vite never bundles it) and
// this folder starts with an underscore, so Vercel does not publish it as an
// endpoint either.
//
//   SUPABASE_URL               https://<project>.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY  Project Settings > API > service_role
// ---------------------------------------------------------------------------

import { createClient } from "@supabase/supabase-js";
import { buildOrderRecord } from "../../src/shop/orderRecord.js";

/** A service role client, or null when the two variables are not set. */
export function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Store a paid checkout session as an order. IDEMPOTENT on
 * stripe_session_id: Stripe can deliver the same event more than once, and
 * a second delivery inserts nothing and changes nothing (ON CONFLICT DO
 * NOTHING), so it can never duplicate an order or reset a status, tracking
 * number or note the staff already set.
 *
 * The first insert also writes the order's first history row. With
 * `backfill` (scripts/backfill-orders.js) that row is dated at the payment
 * and says it was added later, so the history still reads in order.
 *
 * @returns {Promise<{saved: boolean, inserted?: boolean, id?: string|null, problems?: string[]}>}
 * @throws when the database refuses the write (the caller logs it)
 */
export async function saveOrder(session, client = supabaseAdmin(), { backfill = false } = {}) {
  if (!client) return { saved: false };
  const { row, problems } = buildOrderRecord(session);
  if (!row.stripe_session_id) throw new Error("the session has no id");

  const { data, error } = await client
    .from("orders")
    .upsert(row, { onConflict: "stripe_session_id", ignoreDuplicates: true })
    .select("id");
  if (error) throw new Error(`orders upsert failed: ${error.message}`);

  const inserted = Array.isArray(data) && data.length > 0;
  const id = inserted ? data[0].id : null;
  if (inserted) {
    const event = { order_id: id, actor_email: "stripe", from_status: null, to_status: "new", note: "Paid on Stripe" };
    if (backfill) {
      event.note = "Paid on Stripe (added by the backfill)";
      if (row.created_at) event.created_at = row.created_at;
    }
    const { error: eventError } = await client.from("order_events").insert(event);
    // the order itself is safe; a missing first history row is only logged
    if (eventError) console.warn(`[orders] order ${row.stripe_session_id} stored, its first history row was not: ${eventError.message}`);
  }
  return { saved: true, inserted, id, problems };
}
