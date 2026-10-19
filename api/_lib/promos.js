// ---------------------------------------------------------------------------
// Server side checks for promo codes (see src/shop/promos.js for the idea).
// SERVER ONLY: uses the service role client from ./orders.js.
//
// Table public.promo_allowlist (supabase/schema.sql):
//   code, email               one row per person allowed to use a code
//   redeemed_at, redeemed_session   set once, by the webhook, when paid
// ---------------------------------------------------------------------------

import { EMAIL_PATTERN, PROMO_METADATA_KEY, findPromo, normalizeEmail, normalizePromoCode } from "../../src/shop/promos.js";
import { supabaseAdmin } from "./orders.js";

/**
 * May this email use this code right now?
 * @returns {Promise<{ok: true, promo: object, email: string} | {ok: false, reason: string}>}
 *   reason: unknown | bad_email | not_eligible | used | unavailable
 */
export async function checkPromo(rawCode, rawEmail, client = supabaseAdmin()) {
  const promo = findPromo(rawCode);
  if (!promo) return { ok: false, reason: "unknown" };
  const email = normalizeEmail(rawEmail);
  if (!email || !EMAIL_PATTERN.test(email)) return { ok: false, reason: "bad_email" };
  if (!client) return { ok: false, reason: "unavailable" };

  const { data, error } = await client
    .from("promo_allowlist")
    .select("email, redeemed_at")
    .eq("code", promo.code)
    .eq("email", email)
    .maybeSingle();
  if (error) {
    console.error("[promo] allow list lookup failed:", error.message);
    return { ok: false, reason: "unavailable" };
  }
  if (!data) return { ok: false, reason: "not_eligible" };
  if (data.redeemed_at) return { ok: false, reason: "used" };
  return { ok: true, promo, email };
}

/**
 * Mark the promo on a paid session as used. Idempotent: only a row that is
 * still unused is touched, so a Stripe retry changes nothing.
 * @returns {Promise<{marked: boolean, reason?: string}>}
 */
export async function markPromoRedeemed(session, client = supabaseAdmin()) {
  const code = normalizePromoCode(session?.metadata?.[PROMO_METADATA_KEY]);
  if (!code) return { marked: false, reason: "no promo" };
  const email = normalizeEmail(session?.metadata?.promo_email || session?.customer_details?.email || session?.customer_email);
  if (!email) return { marked: false, reason: "no email" };
  if (!client) return { marked: false, reason: "no database" };

  const { data, error } = await client
    .from("promo_allowlist")
    .update({ redeemed_at: new Date().toISOString(), redeemed_session: String(session.id || "") })
    .eq("code", code)
    .eq("email", email)
    .is("redeemed_at", null)
    .select("email");
  if (error) throw new Error(error.message);
  return data?.length ? { marked: true } : { marked: false, reason: "already used or not on the list" };
}
