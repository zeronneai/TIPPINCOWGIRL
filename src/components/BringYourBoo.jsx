// ---------------------------------------------------------------------------
// /bringyourboo: the ticketed "Bring Your Boo: Boots, Brims & Bubbly" night,
// and /bringyourboo/ticket?session_id=... where Stripe returns the buyer.
//
// Standalone like /giveaway (no nav, cart or footer) and its own chunk. The
// page itself (form, Stripe, ticket) is TicketedEvent.jsx; this file only
// holds this night's words and pictures.
// ---------------------------------------------------------------------------

import { getTicketedEvent, money } from "../events/ticketed.js";
import flyer from "../assets/upcoming/bring-your-boo.webp";
import TicketedEvent from "./TicketedEvent.jsx";

const EVENT = getTicketedEvent("bring-your-boo-2026");

// Deborah making the two hats, a 24 second silent loop (public/events/
// bring-your-boo/hero.mp4, 1.4 MB, cut from her reel without the movie
// title graphic).
const CONTENT = {
  kicker: "Tippin' Cowgirl presents",
  title: (
    <>
      Bring Your <span>Boo</span>
    </>
  ),
  facts: [
    { b: EVENT.dateLabel, span: EVENT.timeLabel },
    { b: "The Hat Bar", span: "Shoppes at Solana" },
  ],
  media: { video: "/events/bring-your-boo/hero.mp4", webm: "/events/bring-your-boo/hero.webm", poster: "/events/bring-your-boo/hero.jpg" },
  marquee: "✦ Boots ✦ Brims ✦ Bubbly ✦ Date night ✦ Girls' night ✦ Live country music ✦ Bring your boo",
  intro: (
    <>
      <p>
        A cute western night out at the hat bar. Your boo can be your boyfriend, your girlfriend, your spouse or your bestie,
        so make it a <b>date night</b> or a <b>girls' night</b> 👻🤠
      </p>
      <ul className="byb-list">
        <li>🎶 Live country music</li>
        <li>🥂 Complimentary drinks</li>
        <li>🧀 Small bites</li>
        <li>📸 A cute photo area</li>
      </ul>
    </>
  ),
  flyer: {
    src: flyer,
    width: 900,
    height: 1205,
    alt: "Bring Your Boo flyer: Boots, Brims & Bubbly. Thursday, Oct 29, 6 TO 9 PM at the hat bar. $10 tickets go toward your hat, limited spots.",
  },
  deal: {
    heading: "The deal",
    body: (
      <>
        <p>
          Tickets are <b>{money(EVENT.priceCents)} per person</b>, and the full {money(EVENT.priceCents)} goes toward your hat
          that night.
        </p>
        <p className="byb-special">
          <b>Bring your boo special:</b> when two guests buy hats, each one gets a free premium upgrade (a pin, a studded band
          or a feather bundle) plus a pair of matching custom branded leather keychains 💕
        </p>
      </>
    ),
  },
  form: {
    guestLabel: "Who's your boo?",
    defaultQuantity: 2,
    payLabel: (total) => `Pay ${total} and save my spot`,
  },
  calendarDetails: "Bring your ticket number. Your ticket price goes toward your hat that night.",
};

export default function BringYourBoo({ path }) {
  return <TicketedEvent event={EVENT} content={CONTENT} path={path} />;
}
