// ---------------------------------------------------------------------------
// Ticketed events at the hat bar (the first one: Bring Your Boo).
//
// Pure, zero imports: the event page, api/tickets.js and the Stripe webhook
// all read this, so the price, the cap and the dates live in one place.
//
// HOW A TICKET WORKS
//   1. The page posts the form to /api/tickets. The server checks it,
//      holds the seats (reserve_event_tickets in supabase/schema.sql, which
//      locks so two buyers can never take the last seat together) and sends
//      the visitor to Stripe Checkout.
//   2. A hold lasts HOLD_MINUTES. An unpaid hold stops counting by itself.
//   3. When Stripe confirms payment (webhook, or the ticket page asking
//      Stripe directly if the webhook is slow), the ticket is marked paid
//      and gets its folio, BOO-001, BOO-002... in payment order.
//   4. The ticket page and an email show the folio; Deborah sees every
//      ticket, paid or not, in the staff portal under Tickets.
//
// To run another event: add an entry to TICKETED_EVENTS with a new id and
// folioPrefix, and a page (see src/components/BringYourBoo.jsx and
// BrimsAndBlowouts.jsx, both built on TicketedEvent.jsx). The portal's
// Tickets screen lists every event here on its own.
// ---------------------------------------------------------------------------

export const HOLD_MINUTES = 35; // Stripe Checkout lives 30 minutes; a little slack on top

export const TICKETED_EVENTS = {
  "bring-your-boo-2026": {
    id: "bring-your-boo-2026",
    path: "/bringyourboo",
    title: "Bring Your Boo",
    subtitle: "Boots, Brims & Bubbly",
    // Thursday, October 29, 2026, 6 to 9 PM, El Paso (Mountain Time, UTC-6 in October)
    startsAt: "2026-10-29T18:00:00-06:00",
    endsAt: "2026-10-29T21:00:00-06:00",
    dateLabel: "Thursday, October 29",
    timeLabel: "6 to 9 PM",
    venue: "Tippin' Cowgirl Hat Bar",
    address: "The Shoppes at Solana, 750 Sunland Park Dr, El Paso, TX 79912",
    capacity: 20,
    priceCents: 1000,
    maxPerOrder: 4,
    folioPrefix: "BOO",
    // what Stripe shows on the checkout line and the receipt
    stripeName: "Bring Your Boo ticket, Oct 29 at Tippin' Cowgirl",
    // one line under the ticket (page, email): what the money does
    ticketNote: "Your $10 per ticket goes toward your hat that night.",
    revenueNote: "goes toward their hats",
  },
  // Brims & Blowouts with Nashville Blonde (Rosa's salon): a blowout plus a
  // hat, $135 per person. Online they pay the $70 deposit; the other $65 is
  // paid to Deborah at the event. So priceCents is the deposit.
  "brims-and-blowouts-2026": {
    id: "brims-and-blowouts-2026",
    path: "/brimsandblowouts",
    title: "Brims & Blowouts",
    subtitle: "A ticketed event with Nashville Blonde",
    // Saturday, November 14, 2026, 12 to 6 PM, El Paso (Mountain Standard Time, UTC-7 after Nov 1)
    startsAt: "2026-11-14T12:00:00-07:00",
    endsAt: "2026-11-14T18:00:00-07:00",
    dateLabel: "Saturday, November 14",
    timeLabel: "12 PM TO 6 PM",
    venue: "Nashville Blonde",
    // TODO: the salon's street address once Deborah confirms it
    address: "",
    capacity: 25,
    priceCents: 7000,
    totalCents: 13500,
    balanceCents: 6500,
    maxPerOrder: 4,
    folioPrefix: "BNB",
    stripeName: "Brims & Blowouts deposit, Nov 14 (blowout + hat combo)",
    ticketNote: "Your $70 deposit holds your spot. The remaining $65 per guest is paid at the event.",
    revenueNote: "deposits, $65 more each at the event",
  },
};

export const getTicketedEvent = (id) => TICKETED_EVENTS[id] || null;

/** "Venue, address", or just the venue while the address is not set. */
export const eventPlace = (event) => [event.venue, event.address].filter(Boolean).join(", ");
export const ticketedEventByPath = (path) => Object.values(TICKETED_EVENTS).find((e) => e.path === path) || null;

/** Ticket sales close when the event starts. */
export const salesOpen = (event, now = Date.now()) => !!event && now < Date.parse(event.startsAt);

export const TICKET_LIMITS = { name: 80, email: 120, phone: 40, guestName: 80 };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const clean = (v, max) => {
  const s = String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return { value: s, tooLong: s.length > max };
};

/**
 * The registration form, checked. Used by the page (messages next to each
 * field) and by the server (the check that decides).
 *
 * @returns {{spam: true} | {ok: true, value: object} | {ok: false, errors: object}}
 */
export function cleanTicketRequest(body, event) {
  const b = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  if (String(b.company ?? "").trim()) return { spam: true }; // honeypot

  const errors = {};
  const name = clean(b.name, TICKET_LIMITS.name);
  const email = clean(b.email, TICKET_LIMITS.email);
  const phone = clean(b.phone, TICKET_LIMITS.phone);
  const guestName = clean(b.guestName, TICKET_LIMITS.guestName);
  const quantity = Number(b.quantity);
  const max = event?.maxPerOrder || 1;

  if (!name.value) errors.name = "Tell us your name.";
  else if (name.tooLong) errors.name = `Keep this under ${TICKET_LIMITS.name} characters.`;
  if (!email.value) errors.email = "We need an email to send your ticket.";
  else if (email.tooLong) errors.email = `Keep this under ${TICKET_LIMITS.email} characters.`;
  else if (!EMAIL.test(email.value)) errors.email = "That email does not look right.";
  if (!phone.value) errors.phone = "Leave a phone number in case plans change.";
  else if (phone.tooLong) errors.phone = `Keep this under ${TICKET_LIMITS.phone} characters.`;
  if (guestName.tooLong) errors.guestName = `Keep this under ${TICKET_LIMITS.guestName} characters.`;
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > max) errors.quantity = `Pick 1 to ${max} tickets.`;

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name: name.value,
      email: email.value.toLowerCase(),
      phone: phone.value,
      guestName: guestName.value || null,
      quantity,
    },
  };
}

export const money = (cents) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;
