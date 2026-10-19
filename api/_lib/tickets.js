// ---------------------------------------------------------------------------
// Event tickets, server side (Supabase with the service role, Stripe).
//
// SERVER ONLY, like orders.js: the folder's leading underscore keeps Vercel
// from publishing it, and the service role key never reaches the browser.
// The seat counting and the folio live in Postgres functions
// (reserve_event_tickets, mark_event_ticket_paid in supabase/schema.sql), so
// they are atomic even with two buyers at once.
// ---------------------------------------------------------------------------

import { HOLD_MINUTES, getTicketedEvent, money } from "../../src/events/ticketed.js";
import { supabaseAdmin } from "./orders.js";

/** What Stripe metadata marks a ticket checkout with (the webhook branches on it). */
export const TICKET_KIND = "event_ticket";

export const isTicketSession = (session) => session?.metadata?.kind === TICKET_KIND;

/** A Checkout session id as Stripe makes them; anything else is not looked up. */
export const SESSION_ID = /^cs_(test|live)_[A-Za-z0-9]{10,200}$/;

/** Seats left, counting paid tickets and live holds. Null without a database. */
export async function seatsRemaining(event, client = supabaseAdmin()) {
  if (!client) return null;
  const { data, error } = await client.rpc("event_tickets_remaining", { p_event_id: event.id, p_capacity: event.capacity });
  if (error) throw new Error(`event_tickets_remaining failed: ${error.message}`);
  return typeof data === "number" ? data : Number(data);
}

/**
 * Hold seats for a cleaned request.
 * @returns {Promise<{ticketId: string|null, remaining: number}>} ticketId null = not enough seats
 */
export async function reserveSeats(event, req, client = supabaseAdmin()) {
  if (!client) throw new Error("the database is not configured");
  const { data, error } = await client.rpc("reserve_event_tickets", {
    p_event_id: event.id,
    p_capacity: event.capacity,
    p_quantity: req.quantity,
    p_name: req.name,
    p_email: req.email,
    p_phone: req.phone,
    p_guest_name: req.guestName,
    p_amount_cents: req.quantity * event.priceCents,
    p_hold_minutes: HOLD_MINUTES,
  });
  if (error) throw new Error(`reserve_event_tickets failed: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  return { ticketId: row?.ticket_id ?? null, remaining: Number(row?.remaining ?? 0) };
}

/** Attach the Checkout session to the hold (so the ticket page can find it). */
export async function attachSession(ticketId, sessionId, client = supabaseAdmin()) {
  const { error } = await client.from("event_tickets").update({ stripe_session_id: sessionId }).eq("id", ticketId);
  if (error) throw new Error(`could not attach session: ${error.message}`);
}

/** Free a hold right away (Stripe refused to start the checkout). */
export async function releaseHold(ticketId, client = supabaseAdmin()) {
  if (!client || !ticketId) return;
  const { error } = await client.from("event_tickets").update({ status: "cancelled" }).eq("id", ticketId).eq("status", "pending");
  if (error) console.warn(`[tickets] could not release hold ${ticketId}: ${error.message}`);
}

/**
 * A paid Checkout session, recorded: status paid and a folio. Idempotent.
 * @returns {Promise<object|null>} the ticket row
 */
export async function markPaid(session, client = supabaseAdmin()) {
  if (!client) return null;
  const event = getTicketedEvent(session?.metadata?.event_id);
  const ticketId = session?.metadata?.ticket_id;
  if (!event || !ticketId) throw new Error(`ticket session ${session?.id} has no event_id or ticket_id`);
  const { data, error } = await client.rpc("mark_event_ticket_paid", {
    p_ticket_id: ticketId,
    p_session_id: session.id,
    p_payment_intent: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null,
    p_amount_cents: Number.isFinite(session.amount_total) ? session.amount_total : null,
    p_folio_prefix: event.folioPrefix,
  });
  if (error) throw new Error(`mark_event_ticket_paid failed: ${error.message}`);
  return (Array.isArray(data) ? data[0] : data) || null;
}

/** The ticket as the buyer may see it: no internal notes, no ids. */
export function publicTicket(row) {
  if (!row) return null;
  const event = getTicketedEvent(row.event_id);
  return {
    folio: row.folio || null,
    status: row.status,
    name: row.name,
    guestName: row.guest_name || null,
    quantity: row.quantity,
    amountCents: row.amount_cents,
    eventId: row.event_id,
    eventTitle: event ? `${event.title}: ${event.subtitle}` : row.event_id,
  };
}

export async function ticketBySession(sessionId, client = supabaseAdmin()) {
  if (!client) return null;
  const { data, error } = await client.from("event_tickets").select("*").eq("stripe_session_id", sessionId).maybeSingle();
  if (error) throw new Error(`ticket lookup failed: ${error.message}`);
  return data || null;
}

// ---- emails ---------------------------------------------------------------------------------

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** The buyer's ticket, by email. */
export function buildTicketEmail(row, { baseUrl = "" } = {}) {
  const event = getTicketedEvent(row.event_id);
  const seats = `${row.quantity} ${row.quantity === 1 ? "guest" : "guests"}`;
  const link = baseUrl && row.stripe_session_id ? `${baseUrl}${event.path}/ticket?session_id=${encodeURIComponent(row.stripe_session_id)}` : "";
  const subject = `Your ticket ${row.folio}: ${event.title}, ${event.dateLabel}`;
  const text = [
    `Hi ${row.name}!`,
    "",
    `You're in for ${event.title}: ${event.subtitle}.`,
    "",
    `Ticket: ${row.folio}`,
    `Admits: ${seats}${row.guest_name ? ` (with ${row.guest_name})` : ""}`,
    `When: ${event.dateLabel}, ${event.timeLabel}`,
    `Where: ${event.venue}, ${event.address}`,
    "",
    `Your ${money(event.priceCents)} per ticket goes toward your hat that night.`,
    "Show this email or your ticket number at the door.",
    link ? `\nYour ticket online: ${link}` : "",
    "",
    "See you there, cowgirl!",
    "Tippin' Cowgirl",
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#faf1e2;font-family:Helvetica,Arial,sans-serif;color:#2b1a10">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf1e2;padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fffaf0;border:2px solid #2b1a10;border-radius:18px;overflow:hidden">
<tr><td style="background:#2b1a10;color:#faf1e2;padding:22px 26px;text-align:center">
<div style="font-size:12px;letter-spacing:.24em;text-transform:uppercase;opacity:.8">Tippin' Cowgirl presents</div>
<div style="font-family:Georgia,serif;font-size:30px;font-weight:bold;color:#e8674a;margin-top:6px">${esc(event.title)}</div>
<div style="font-size:15px;margin-top:4px">${esc(event.subtitle)}</div></td></tr>
<tr><td style="padding:26px;text-align:center">
<p style="margin:0 0 6px;font-size:16px">Hi ${esc(row.name)}, you're in! 🤠</p>
<div style="margin:18px auto;padding:16px;border:2px dashed #b04e28;border-radius:12px;max-width:300px">
<div style="font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#6f4526">Ticket</div>
<div style="font-family:'Courier New',monospace;font-size:34px;font-weight:bold;color:#b04e28;letter-spacing:.06em">${esc(row.folio)}</div>
<div style="font-size:14px;margin-top:4px">Admits ${esc(seats)}${row.guest_name ? ` &middot; with ${esc(row.guest_name)}` : ""}</div></div>
<p style="margin:0;font-size:15px;line-height:1.6"><b>${esc(event.dateLabel)}, ${esc(event.timeLabel)}</b><br>${esc(event.venue)}<br>${esc(event.address)}</p>
<p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#4a3a2c">Your ${money(event.priceCents)} per ticket goes toward your hat that night. Show this email or your ticket number at the door.</p>
${link ? `<p style="margin:20px 0 0"><a href="${esc(link)}" style="display:inline-block;background:#b04e28;color:#fff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:10px">See my ticket</a></p>` : ""}
</td></tr></table></td></tr></table></body></html>`;
  return { subject, text, html };
}

/** The heads up for Deborah. */
export function buildTicketNotice(row, { remaining = null } = {}) {
  const event = getTicketedEvent(row.event_id);
  const subject = `New ticket ${row.folio}: ${row.name} x ${row.quantity} (${event.title})`;
  const lines = [
    `${row.name} bought ${row.quantity} ${row.quantity === 1 ? "ticket" : "tickets"} for ${event.title}.`,
    "",
    `Folio: ${row.folio}`,
    `Guest: ${row.guest_name || "not given"}`,
    `Email: ${row.email}`,
    `Phone: ${row.phone || "not given"}`,
    `Paid: ${money(row.amount_cents || 0)}`,
    remaining === null ? "" : `Seats left: ${remaining} of ${event.capacity}`,
    "",
    "Every ticket is in the staff portal under Tickets.",
  ];
  const text = lines.join("\n");
  const html = `<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#2b1a10">${lines.map((l) => (l ? esc(l) : "&nbsp;")).join("<br>")}</div>`;
  return { subject, text, html };
}
