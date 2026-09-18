// ---------------------------------------------------------------------------
// POST /api/stripe-webhook
//
// Stripe tells us a checkout was paid; we email Deborah the full build of
// every hat in the order. Stripe's own receipt only says how much was paid,
// which is useless for something made to order.
//
// RAW BODY, NOT PARSED JSON. Signature verification hashes the request body
// byte for byte, so the `config` export below turns Vercel's body parser off
// and readRawBody() pulls the bytes off the stream. A parsed and
// re-serialized body produces a different hash and every delivery fails
// verification. This is the single most common way a Stripe webhook breaks,
// so readRawBody also refuses loudly if it is ever handed an already parsed
// object instead of quietly computing a wrong signature.
//
// NO DEDUPLICATION. Stripe retries a delivery it considers failed, and it
// can send the same event more than once. With no database to record
// processed event ids, a retry means Deborah gets the same order email
// twice. At this volume a duplicate email is a minor annoyance and a missed
// order is not, so we take that trade. If a database ever lands here, store
// event.id on arrival and drop events already seen.
//
// ALWAYS 200 ONCE THE SIGNATURE CHECKS OUT, even if the email fails. A non
// 2xx makes Stripe retry, and retries with a broken mail provider means a
// pile of duplicates later. A failed send is logged with the session id so
// the order can be recovered by hand from the Stripe dashboard.
//
// ENVIRONMENT VARIABLES (Vercel: Project > Settings > Environment
// Variables, then redeploy):
//
//   STRIPE_SECRET_KEY         required. Same key the checkout function uses.
//   STRIPE_WEBHOOK_SECRET     required. The signing secret Stripe shows when
//                             you add this endpoint under Developers >
//                             Webhooks. It starts with whsec_ and is NOT the
//                             API key. Each endpoint has its own, and the
//                             local CLI has a different one again.
//   RESEND_API_KEY            required. From resend.com, API Keys.
//   ORDER_NOTIFICATION_EMAIL  required. Where order emails land.
//   PUBLIC_BASE_URL           optional. Absolute site origin used to build
//                             the "See this hat" links. Without it the links
//                             are left out of the email.
// ---------------------------------------------------------------------------

import { Resend } from "resend";
import Stripe from "stripe";
import { buildOrderEmail } from "../src/shop/orderEmail.js";

// Vercel parses JSON bodies by default. Stripe signatures do not survive
// that, so it stays off for this function.
export const config = { api: { bodyParser: false } };

// TODO(sender): swap to an address on the verified domain once DNS is set up
// in Resend. onboarding@resend.dev works out of the box but can only send to
// the address that owns the Resend account.
const FROM = "Tippin Cowgirl Orders <onboarding@resend.dev>";

/** Collect the untouched request bytes. */
async function readRawBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") return Buffer.from(req.body, "utf8");
  if (req.body && typeof req.body === "object") {
    // The parser ran and the original bytes are gone. Any signature computed
    // from a re-serialized body would be wrong, so say so instead.
    throw new Error(
      "Request body was already parsed. The bodyParser config export is not taking effect, so Stripe signatures cannot be verified."
    );
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(typeof chunk === "string" ? Buffer.from(chunk, "utf8") : chunk);
  return Buffer.concat(chunks);
}

function resolveOrigin(req) {
  const configured = process.env.PUBLIC_BASE_URL;
  if (configured) return configured.replace(/\/+$/, "");
  const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
  if (!/^[A-Za-z0-9.\-:]+$/.test(host)) return "";
  return `${proto === "http" ? "http" : "https"}://${host}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!webhookSecret || !secretKey) {
    console.error(
      "[webhook] STRIPE_WEBHOOK_SECRET or STRIPE_SECRET_KEY is missing. Set both in Vercel and redeploy."
    );
    // 500 on purpose: this one IS worth retrying once the config is fixed.
    return res.status(500).json({ error: "Webhook is not configured" });
  }

  let event;
  try {
    const raw = await readRawBody(req);
    const signature = req.headers["stripe-signature"];
    // Throws on a bad or missing signature, a replayed timestamp, or a body
    // that does not hash to the signature we were sent.
    event = new Stripe(secretKey).webhooks.constructEvent(raw, signature, webhookSecret);
  } catch (err) {
    console.error("[webhook] signature verification failed:", err.message);
    return res.status(400).json({ error: "Invalid signature" });
  }

  // Past this line the request is genuinely from Stripe, so the answer is
  // 200 no matter what happens next.
  if (event.type !== "checkout.session.completed")
    return res.status(200).json({ received: true, ignored: event.type });

  const session = event.data?.object || {};
  if (session.payment_status !== "paid")
    return res.status(200).json({ received: true, ignored: `payment_status ${session.payment_status}` });

  try {
    const resendKey = process.env.RESEND_API_KEY;
    const to = process.env.ORDER_NOTIFICATION_EMAIL;
    if (!resendKey || !to) {
      console.error(
        `[webhook] cannot send the order email for ${session.id}: RESEND_API_KEY or ORDER_NOTIFICATION_EMAIL is missing.`
      );
      return res.status(200).json({ received: true, emailed: false });
    }

    const { subject, html, text, problems } = buildOrderEmail({
      session,
      baseUrl: resolveOrigin(req),
    });
    if (problems.length)
      console.warn(`[webhook] order ${session.id} had unreadable metadata:`, problems.join(" | "));

    const { error } = await new Resend(resendKey).emails.send({ from: FROM, to, subject, html, text });
    if (error) {
      console.error(`[webhook] Resend refused the order email for ${session.id}:`, error);
      return res.status(200).json({ received: true, emailed: false });
    }
    return res.status(200).json({ received: true, emailed: true });
  } catch (err) {
    // Swallowed on purpose: see the ALWAYS 200 note at the top.
    console.error(`[webhook] order notification failed for ${session.id}:`, err);
    return res.status(200).json({ received: true, emailed: false });
  }
}
