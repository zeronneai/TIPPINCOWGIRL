// ---------------------------------------------------------------------------
// POST /api/create-checkout-session
//
// Creates a Stripe Checkout session for a cart of hats. Vercel serverless
// function (Node runtime); the repo is "type": "module", so the ESM import
// of the shared pricing module below resolves natively and @vercel/node
// bundles that file into the deployed function. There is exactly one price
// list in this project and it lives in src/shop/pricing.js.
//
// Request body: { cart: [ { baseId, featherId, cordId, cordColor,
// stitchingNote, budSize, budColor, matchesColor, size, quantity }, ... ] }
// (the exact field list is CONFIG_FIELDS in pricing.js; brand fields are
// accepted and ignored while BRANDS_ENABLED is off)
//
// THE RULE: the browser never sends money. The body carries only the chosen
// configuration. This function revalidates every line against the catalog
// with validateCart() and recomputes every amount with buildOrder() before
// talking to Stripe. Tampering with the front end changes nothing about
// what gets charged.
//
// ENVIRONMENT VARIABLES (Vercel dashboard: Project > Settings >
// Environment Variables; add to Production, Preview and Development, then
// redeploy so the running functions pick them up):
//
//   STRIPE_SECRET_KEY  required. The secret key from Stripe's dashboard
//                      (Developers > API keys). Use the TEST key, the one
//                      starting with sk_test_, until you are ready to take
//                      real money. Never commit it, never expose it to the
//                      browser, never prefix it with VITE_ (anything with
//                      that prefix is bundled into the client).
//
//   PUBLIC_BASE_URL    optional. Absolute site origin used to build the
//                      success and cancel URLs, e.g.
//                      https://tippincowgirl.com . When unset the
//                      origin is derived from the request headers, which is
//                      what you want on preview deployments.
//
// ---------------------------------------------------------------------------

import Stripe from "stripe";
import { encodeOrderMetadata } from "../src/shop/orderMetadata.js";
import { buildOrder, pickConfig, validateCart } from "../src/shop/pricing.js";

// SESSION METADATA: the format (v2, with v1 still readable), the key budget
// and the 500 character limit are all documented in src/shop/orderMetadata.js,
// which both writes it here and reads it back in the webhook.

// A cart is a list of short id records. Ten hats fit in a couple of KB;
// anything past this is not a customer.
const MAX_BODY_BYTES = 8192;

const json = (res, status, payload) => res.status(status).json(payload);

/** Derive the site origin for the success and cancel URLs. */
function resolveOrigin(req) {
  const configured = process.env.PUBLIC_BASE_URL;
  if (configured) return configured.replace(/\/+$/, "");
  const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
  // Host arrives from the request, so keep it to characters a hostname can
  // actually contain before pasting it into a URL.
  if (!/^[A-Za-z0-9.\-:]+$/.test(host)) return "";
  return `${proto === "http" ? "http" : "https"}://${host}`;
}

/** Best effort size guard: the header first, the parsed body as a backstop. */
function isBodyTooLarge(req) {
  const declared = Number(req.headers["content-length"]);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return true;
  if (Buffer.isBuffer(req.body)) return req.body.length > MAX_BODY_BYTES;
  if (typeof req.body === "string") return Buffer.byteLength(req.body, "utf8") > MAX_BODY_BYTES;
  try {
    return Buffer.byteLength(JSON.stringify(req.body ?? ""), "utf8") > MAX_BODY_BYTES;
  } catch {
    return true; // unserializable body: refuse rather than guess
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "Method not allowed" });
  }

  if (isBodyTooLarge(req)) return json(res, 413, { error: "Request body too large" });

  // Vercel parses JSON bodies for us, but fall back gracefully when the
  // runtime hands over a raw string or Buffer instead.
  let payload = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : req.body;
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      return json(res, 400, { error: "Invalid JSON body" });
    }
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    return json(res, 400, { error: "Invalid request body" });

  // Only the design fields (CONFIG_FIELDS) and quantity are read, per line,
  // through pickConfig. Any price, total or currency the
  // client tries to send is simply never looked at, and neither is the
  // line's `id`: that is the browser's own row handle and must not touch
  // anything about the charge.
  // Not truncated on purpose: an oversized cart must be rejected by
  // validateCart, never silently trimmed into something chargeable.
  const cart = Array.isArray(payload.cart) ? payload.cart.map((line) => pickConfig(line)) : null;

  if (!cart) return json(res, 400, { error: "Invalid cart" });

  const { valid, errors } = validateCart(cart);
  if (!valid) return json(res, 400, { error: "Invalid cart", errors });

  // Server side numbers, computed from the catalog, not from the request.
  const order = buildOrder(cart);

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    console.error(
      "[checkout] STRIPE_SECRET_KEY is not set. Add it in Vercel under Project > Settings > Environment Variables and redeploy."
    );
    return json(res, 500, { error: "Checkout is not available right now" });
  }

  const origin = resolveOrigin(req);
  if (!origin) {
    console.error("[checkout] Could not resolve a site origin. Set PUBLIC_BASE_URL.");
    return json(res, 500, { error: "Checkout is not available right now" });
  }

  const currency = order.currency.toLowerCase();

  const metadata = encodeOrderMetadata(order);

  try {
    const stripe = new Stripe(secretKey);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: order.items.map((item) => ({
        quantity: item.quantity,
        price_data: {
          currency,
          unit_amount: item.unitPrice,
          product_data: { name: item.label },
        },
      })),
      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: { amount: order.shipping, currency },
            display_name: order.freeShippingApplied ? "Free shipping" : "Standard shipping",
          },
        },
      ],
      shipping_address_collection: { allowed_countries: ["US"] },
      phone_number_collection: { enabled: true },
      // TODO(tax): turn on automatic_tax once the Stripe Tax registration
      // for Texas is done, and add the origin address in the dashboard.
      // automatic_tax: { enabled: true },
      success_url: `${origin}/order-confirmed?session_id={CHECKOUT_SESSION_ID}`,
      // The cart survives in the browser, so cancelling needs no state
      // carried on the URL.
      cancel_url: `${origin}/checkout-cancelled`,
      metadata,
    });

    if (!session?.url) {
      console.error("[checkout] Stripe returned a session with no URL:", session?.id);
      return json(res, 502, { error: "Could not start checkout" });
    }
    return json(res, 200, { url: session.url, sessionId: session.id });
  } catch (err) {
    // Log the detail for us, return nothing that could leak keys or the
    // shape of our Stripe account to the browser.
    console.error("[checkout] Stripe session creation failed:", err);
    return json(res, 502, { error: "Could not start checkout" });
  }
}
