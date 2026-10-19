// ---------------------------------------------------------------------------
// /api/tickets: ticketed events (src/events/ticketed.js).
//
//   GET  ?event=<id>            seats left and whether sales are open
//   GET  ?session_id=cs_...     the buyer's ticket after Checkout. If the
//                               webhook has not landed yet, Stripe is asked
//                               directly and a paid session is recorded here
//                               (idempotent, same function the webhook uses).
//   POST { eventId, name, email, phone, guestName, quantity, company }
//                               holds the seats and answers { url } for
//                               Stripe Checkout, or 409 with seats left.
//
// THE RULE, as for hats: the browser never sends money. The price and the
// cap come from src/events/ticketed.js, the seat count from the database.
//
// Needs STRIPE_SECRET_KEY, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. The
// ticket emails go out from the Stripe webhook (api/stripe-webhook.js).
// ---------------------------------------------------------------------------

import Stripe from "stripe";
import { HOLD_MINUTES, cleanTicketRequest, getTicketedEvent, salesOpen } from "../src/events/ticketed.js";
import { supabaseAdmin } from "./_lib/orders.js";
import {
  SESSION_ID,
  TICKET_KIND,
  attachSession,
  markPaid,
  publicTicket,
  releaseHold,
  reserveSeats,
  seatsRemaining,
  ticketBySession,
} from "./_lib/tickets.js";

const MAX_BODY_BYTES = 4096;

function resolveOrigin(req) {
  const configured = process.env.PUBLIC_BASE_URL;
  if (configured) return configured.replace(/\/+$/, "");
  const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
  if (!/^[A-Za-z0-9.\-:]+$/.test(host)) return "";
  return `${proto === "http" ? "http" : "https"}://${host}`;
}

function readBody(req) {
  const b = req.body;
  if (b && typeof b === "object" && !Buffer.isBuffer(b)) return b;
  const text = Buffer.isBuffer(b) ? b.toString("utf8") : typeof b === "string" ? b : "";
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

export default async function handler(req, res, deps = {}) {
  const db = deps.db !== undefined ? deps.db : supabaseAdmin();
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const stripe = deps.stripe || (stripeKey ? new Stripe(stripeKey) : null);
  const now = deps.now ?? Date.now();
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "GET") {
    const q = req.query || Object.fromEntries(new URL(req.url, "http://x").searchParams);

    // ---- the buyer's ticket ----
    if (q.session_id) {
      const sessionId = String(q.session_id);
      if (!SESSION_ID.test(sessionId)) return res.status(400).json({ error: "Invalid ticket link" });
      if (!db) return res.status(503).json({ error: "Tickets are not available right now" });
      try {
        let row = await ticketBySession(sessionId, db);
        if (!row) return res.status(404).json({ error: "We could not find that ticket" });
        if (row.status === "pending" && stripe) {
          const session = await stripe.checkout.sessions.retrieve(sessionId);
          if (session?.payment_status === "paid" && session?.metadata?.kind === TICKET_KIND) row = (await markPaid(session, db)) || row;
        }
        return res.status(200).json({ ticket: publicTicket(row) });
      } catch (err) {
        console.error("[tickets] ticket lookup failed:", err?.message || err);
        return res.status(502).json({ error: "Could not load your ticket. Refresh in a moment." });
      }
    }

    // ---- seats left ----
    const event = getTicketedEvent(String(q.event || ""));
    if (!event) return res.status(404).json({ error: "No such event" });
    const open = salesOpen(event, now);
    if (!db) return res.status(200).json({ capacity: event.capacity, remaining: null, open });
    try {
      const remaining = await seatsRemaining(event, db);
      return res.status(200).json({ capacity: event.capacity, remaining, open });
    } catch (err) {
      console.error("[tickets] seat count failed:", err?.message || err);
      return res.status(200).json({ capacity: event.capacity, remaining: null, open });
    }
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (Number(req.headers?.["content-length"] || 0) > MAX_BODY_BYTES) return res.status(413).json({ error: "Too large" });
  const body = readBody(req);
  if (!body) return res.status(400).json({ error: "Invalid request" });

  const event = getTicketedEvent(String(body.eventId || ""));
  if (!event) return res.status(404).json({ error: "No such event" });
  if (!salesOpen(event, now)) return res.status(410).json({ error: "Ticket sales for this event are closed." });

  const checked = cleanTicketRequest(body, event);
  if (checked.spam) return res.status(200).json({ ok: true });
  if (!checked.ok) return res.status(400).json({ error: "Check the form", errors: checked.errors });

  if (!db || !stripe) {
    console.error("[tickets] SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or STRIPE_SECRET_KEY is missing.");
    return res.status(503).json({ error: "Tickets are not available right now. DM us on Instagram." });
  }
  const origin = resolveOrigin(req);
  if (!origin) return res.status(500).json({ error: "Tickets are not available right now" });

  let held;
  try {
    held = await reserveSeats(event, checked.value, db);
  } catch (err) {
    console.error("[tickets] could not hold seats:", err?.message || err);
    return res.status(502).json({ error: "Something hiccuped. Try again in a moment." });
  }
  if (!held.ticketId) {
    const left = held.remaining;
    return res.status(409).json({
      error: left > 0 ? `Only ${left} ${left === 1 ? "spot is" : "spots are"} left.` : "This event is sold out.",
      remaining: left,
    });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: checked.value.email,
      line_items: [
        {
          quantity: checked.value.quantity,
          price_data: { currency: "usd", unit_amount: event.priceCents, product_data: { name: event.stripeName } },
        },
      ],
      // Stripe allows 30 minutes at the least; the hold lasts a bit longer
      expires_at: Math.floor(now / 1000) + 30 * 60 + 60,
      success_url: `${origin}${event.path}/ticket?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}${event.path}?cancelled=1`,
      metadata: { kind: TICKET_KIND, event_id: event.id, ticket_id: held.ticketId },
      payment_intent_data: { description: `${event.title} ticket x ${checked.value.quantity}` },
    });
    await attachSession(held.ticketId, session.id, db);
    return res.status(200).json({ url: session.url, holdMinutes: HOLD_MINUTES });
  } catch (err) {
    console.error("[tickets] Stripe session failed:", err?.message || err);
    await releaseHold(held.ticketId, db);
    return res.status(502).json({ error: "Could not start checkout. Try again in a moment." });
  }
}
