// ---------------------------------------------------------------------------
// POST /api/stripe-webhook
//
// Stripe tells us a checkout was paid and two emails go out from here:
//
//   1. the work order to Deborah (orderEmail.js), the full build of every
//      hat. Stripe's own receipt only says how much was paid, which is
//      useless for something made to order.
//   2. the confirmation to the customer (customerEmail.js), so a person who
//      just paid three figures for a handmade hat hears from the brand
//      instead of silence.
//
// They are sent independently, each one's failure logged and swallowed. The
// work order goes first because it is the one the business cannot lose.
//
// RAW BODY, NOT PARSED JSON. Signature verification hashes the request body
// byte for byte. The `config` export below asks Vercel to leave the body
// alone, but readRawBody() does not depend on that directive being honoured:
// it reads the request stream itself whenever the stream is still unread,
// and only falls back to req.body. A parsed and re-serialized body produces
// a different hash and every delivery fails verification, so readRawBody
// refuses loudly when it is handed an already parsed object rather than
// quietly computing a wrong signature.
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
//   ORDER_NOTIFICATION_EMAIL  required. Where the work order lands, and the
//                             Reply-To on the customer's confirmation.
//   PUBLIC_BASE_URL           optional. Absolute site origin used to build
//                             the "See this hat" links. Without it the links
//                             are left out of the email.
// ---------------------------------------------------------------------------

import { Resend } from "resend";
import Stripe from "stripe";
import { buildCustomerEmail } from "../src/shop/customerEmail.js";
import { buildOrderEmail } from "../src/shop/orderEmail.js";

// Vercel parses JSON bodies by default. Stripe signatures do not survive
// that, so it stays off for this function.
export const config = { api: { bodyParser: false } };

// Sends from the custom domain. This requires the domain to be verified in
// Resend (DNS records for SPF and DKIM); until that verification finishes,
// Resend refuses the send and the function logs it and still answers 200.
const FROM = "Tippin' Cowgirl <orders@tippincowgirl.com>";

/**
 * Collect the untouched request bytes, without trusting the config export
 * above to have been honoured. Order matters: the still unread stream is the
 * only source guaranteed to hold the original bytes, so it is tried first
 * and req.body is only a fallback.
 *
 * @returns {{raw: Buffer, source: string}}
 */
async function readRawBody(req) {
  // Some platforms hand the untouched bytes over on the side.
  if (Buffer.isBuffer(req.rawBody)) return { raw: req.rawBody, source: "req.rawBody buffer" };
  if (typeof req.rawBody === "string") return { raw: Buffer.from(req.rawBody, "utf8"), source: "req.rawBody string" };

  // Nothing has drained the stream, so read it ourselves. This is the path
  // that works whether or not the bodyParser directive took effect.
  if (req.readable) {
    const chunks = [];
    for await (const chunk of req) chunks.push(typeof chunk === "string" ? Buffer.from(chunk, "utf8") : chunk);
    return { raw: Buffer.concat(chunks), source: "request stream" };
  }

  if (Buffer.isBuffer(req.body)) return { raw: req.body, source: "req.body buffer" };
  if (typeof req.body === "string") return { raw: Buffer.from(req.body, "utf8"), source: "req.body string" };

  if (req.body && typeof req.body === "object") {
    // The parser ran and the original bytes are gone. A signature computed
    // from a re-serialized body would be wrong, so say so instead of
    // quietly failing verification.
    throw new Error(
      "Request body arrived already parsed into an object and the stream was drained, so the original bytes are gone. The bodyParser:false directive is not taking effect in this runtime."
    );
  }
  throw new Error("Request body was empty and the stream was not readable.");
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
    const { raw } = await readRawBody(req);
    // Throws on a bad or missing signature, a body that does not hash to the
    // signature we were sent, or a timestamp outside the tolerance window.
    event = new Stripe(secretKey).webhooks.constructEvent(
      raw,
      req.headers["stripe-signature"],
      webhookSecret
    );
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

    const resend = new Resend(resendKey);

    // ---- 1. the work order, to Deborah. This one is the order. ------------
    const { subject, html, text, problems } = buildOrderEmail({
      session,
      baseUrl: resolveOrigin(req),
    });
    if (problems.length)
      console.warn(`[webhook] order ${session.id} had unreadable metadata:`, problems.join(" | "));

    let emailed = false;
    const { error } = await resend.emails.send({ from: FROM, to, subject, html, text });
    if (error) console.error(`[webhook] Resend refused the order email for ${session.id}:`, error);
    else emailed = true;

    // ---- 2. the confirmation, to the customer. A courtesy on top. --------
    //
    // Its own try/catch, on purpose. By this line the work order has already
    // been attempted and, if it went out, the order cannot be lost. Nothing
    // this block does is allowed to take that down, and a customer with no
    // email on the session is not an error, just nothing to send.
    let confirmed = false;
    try {
      const customerTo = session.customer_details?.email;
      if (!customerTo) {
        console.warn(`[webhook] no customer email on ${session.id}, skipping the confirmation.`);
      } else {
        const confirmation = buildCustomerEmail({ session });
        // Replies go to Deborah, not to the no-reply sending address, so
        // "wait, my address is wrong" lands somewhere a human reads.
        const { error: confirmError } = await resend.emails.send({
          from: FROM,
          to: customerTo,
          replyTo: to,
          subject: confirmation.subject,
          html: confirmation.html,
          text: confirmation.text,
        });
        if (confirmError)
          console.error(`[webhook] Resend refused the customer confirmation for ${session.id}:`, confirmError);
        else confirmed = true;
      }
    } catch (err) {
      console.error(`[webhook] customer confirmation failed for ${session.id}:`, err);
    }

    return res.status(200).json({ received: true, emailed, confirmed });
  } catch (err) {
    // Swallowed on purpose: see the ALWAYS 200 note at the top.
    console.error(`[webhook] order notification failed for ${session.id}:`, err);
    return res.status(200).json({ received: true, emailed: false });
  }
}
