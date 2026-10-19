// ---------------------------------------------------------------------------
// Promo codes. Shared by the cart (to say what a code is), the checkout
// endpoint (to apply it) and the order record and emails (to show it).
//
// A promo here is NOT a public Stripe promotion code. Stripe's own "once per
// customer" limit cannot tell two guest checkouts by the same person apart,
// so the rule lives on our side:
//
//   - every promo has an allow list in Supabase (promo_allowlist): the
//     emails that may use it, e.g. everyone who entered the giveaway
//   - checkout only applies the promo when the email is on that list and has
//     not used it yet, and locks the Stripe checkout to that email
//   - the webhook marks it used once the payment goes through
//
// The discount itself is a Stripe COUPON whose id equals `coupon` below,
// created in the Stripe dashboard (Product catalog > Coupons). Its expiry
// date (redeem_by) lives on that coupon in Stripe.
// ---------------------------------------------------------------------------

export const PROMOS = {
  GIVEAWAY10: {
    code: "GIVEAWAY10",
    coupon: "GIVEAWAY10",
    label: "Giveaway 10% off",
    // only shown in the cart; Stripe applies the real discount
    blurb: "10% off your hats, for our giveaway list. One use per person.",
  },
};

/** "  giveaway10 " -> "GIVEAWAY10" */
export const normalizePromoCode = (code) =>
  String(code ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .slice(0, 40);

/** "  Ana@Mail.com " -> "ana@mail.com" */
export const normalizeEmail = (email) =>
  String(email ?? "")
    .trim()
    .toLowerCase()
    .slice(0, 120);

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The promo for a code, or null. */
export const findPromo = (code) => PROMOS[normalizePromoCode(code)] || null;

/** Metadata key the checkout writes the promo code under. */
export const PROMO_METADATA_KEY = "promo";

/**
 * The discount Stripe actually applied to a paid session, for the record
 * and the emails: { amount: cents (0 when none), code: string|null }.
 */
export function discountOf(session) {
  const s = session || {};
  const n = Number(s.total_details?.amount_discount);
  const amount = Number.isFinite(n) && n > 0 ? n : 0;
  const code = normalizePromoCode(s.metadata?.[PROMO_METADATA_KEY]) || null;
  return { amount, code: amount || code ? code : null };
}

/** What the customer reads when a code is refused, by reason. */
export const PROMO_MESSAGES = {
  unknown: "That code does not exist. Check the spelling and try again.",
  bad_email: "Enter the email you used to enter our giveaway.",
  not_eligible: "This code is only for our giveaway list. Use the same email you entered with.",
  used: "This code was already used with that email.",
  expired: "This code is no longer active.",
  unavailable: "Codes cannot be applied right now. Try again in a moment, or check out without it.",
};
