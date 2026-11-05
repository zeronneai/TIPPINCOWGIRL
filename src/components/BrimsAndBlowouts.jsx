// ---------------------------------------------------------------------------
// /brimsandblowouts: "Brims & Blowouts", the ticketed afternoon with
// Nashville Blonde, and /brimsandblowouts/ticket?session_id=... after Stripe.
//
// The combo is a blowout plus a hat, $135 per person. Online guests pay the
// $65 deposit (priceCents in src/events/ticketed.js); the remaining $70 is
// paid to Deborah at the event. Same page, form and Stripe flow as Bring
// Your Boo (TicketedEvent.jsx); the tickets land in the portal under Tickets.
// ---------------------------------------------------------------------------

import { getTicketedEvent, money } from "../events/ticketed.js";
import flyer from "../assets/upcoming/brims-and-blowouts.webp";
import TicketedEvent from "./TicketedEvent.jsx";

const EVENT = getTicketedEvent("brims-and-blowouts-2026");
const DEPOSIT = money(EVENT.priceCents);
const BALANCE = money(EVENT.balanceCents);
const TOTAL = money(EVENT.totalCents);

const CONTENT = {
  pageClass: "byb--bnb",
  kicker: "Tippin' Cowgirl x Nashville Blonde",
  title: (
    <>
      Brims &amp; <span>Blowouts</span>
    </>
  ),
  facts: [
    { b: EVENT.dateLabel, span: EVENT.timeLabel },
    { b: EVENT.venue, span: `Only ${EVENT.capacity} spots` },
  ],
  // the flyer photo without its text (public/events/brims-and-blowouts/hero.jpg)
  media: { poster: "/events/brims-and-blowouts/hero.jpg" },
  marquee: "✦ Fresh blowout ✦ Custom hat ✦ Good hair ✦ Good hats ✦ Good company ✦ Brims & Blowouts",
  intro: (
    <>
      <p>
        A fresh blowout plus a custom hat is the perfect combo. We're teaming up with <b>Nashville Blonde</b> for an
        afternoon full of good hair, good hats and good company 💇‍♀️🤠
      </p>
      <ul className="byb-list">
        <li>💇‍♀️ A blowout by Nashville Blonde</li>
        <li>🤠 A custom hat by Tippin' Cowgirl</li>
        <li>✨ Only {EVENT.capacity} spots</li>
      </ul>
    </>
  ),
  flyer: {
    src: flyer,
    width: 900,
    height: 1205,
    alt: "Brims & Blowouts flyer: a ticketed event with Nashville Blonde. Saturday, November 14. Limited spots, tickets at tippincowgirl.com.",
  },
  deal: {
    heading: "The combo",
    body: (
      <>
        <p>
          <b>{TOTAL} per person</b> for a blowout and a custom hat.
        </p>
        <p className="byb-special">
          <b>Save your spot with a {DEPOSIT} deposit today.</b> The remaining {BALANCE} is paid at the event.
        </p>
      </>
    ),
  },
  form: {
    heading: "Save your spot",
    guestLabel: "Bringing a friend? Their name",
    guestPlaceholder: "Your friend's name",
    quantityLabel: "Spots",
    totalLabel: "Deposit today",
    defaultQuantity: 1,
    quantityHint: (q) => `Then ${money(EVENT.balanceCents * q)} at the event (${money(EVENT.totalCents * q)} total).`,
    payLabel: (total) => `Pay ${total} deposit and save my spot`,
  },
  calendarDetails: `Brims & Blowouts with Nashville Blonde. Bring your ticket number. Your deposit holds your spot; the remaining ${BALANCE} per guest is paid at the event.`,
};

export default function BrimsAndBlowouts({ path }) {
  return <TicketedEvent event={EVENT} content={CONTENT} path={path} />;
}
