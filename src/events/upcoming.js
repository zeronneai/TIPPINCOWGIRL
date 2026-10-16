// ---------------------------------------------------------------------------
// Upcoming hat bar events (pop-ups, markets, collabs). Shown on /events and,
// the next two, on the landing. An event disappears on its own the day after
// its last date, so nobody has to remember to take it down.
//
// To add one: append an entry and drop its flyer as
// src/assets/upcoming/<id>.webp (portrait 3:4, about 900 px wide). Without a
// flyer the card still renders, just without the image.
//
//   sessions   one entry per day the bar is there:
//                date   YYYY-MM-DD (Mountain Time)
//                day    what people read, e.g. "Saturday, October 17"
//                time   what people read; ranges use "TO", never a dash.
//                       Leave it out when the time is not announced yet.
//                start  24 h "HH:MM", for "Add to calendar" (optional)
//                end    24 h "HH:MM" (optional; 2 hours after start if missing)
//   place      where, as people read it
//   mapsQuery  what Google Maps searches for "Get directions" (leave it out
//              to hide the button when there is no reliable address)
//   partner    the collab partner, shown as "With ..." (optional)
//   note       one short line such as "Free admission" (optional)
// ---------------------------------------------------------------------------

export const EVENT_TIME_ZONE = "America/Denver";

export const UPCOMING_EVENTS = [
  {
    id: "back-on-the-farm",
    kicker: "After the rain",
    title: "Back on the Farm",
    sessions: [{ date: "2026-10-17", day: "Saturday, October 17", time: "10:00 AM TO 4:00 PM", start: "10:00", end: "16:00" }],
    place: "Valley Farms NM Farm Store",
    mapsQuery: "Valley Farms NM Farm Store",
    blurb:
      "After the rain, we're finally making it happen! Come build your hat with us at the sweetest little farm store.",
  },
  {
    id: "trick-or-treat-yourself",
    kicker: "Halloween BBQ Mega Market",
    title: "Trick or Treat Yourself",
    sessions: [{ date: "2026-10-17", day: "Saturday, October 17", time: "2 PM TO 8 PM", start: "14:00", end: "20:00" }],
    place: "El Paso County Coliseum, 4100 E. Paisano Dr.",
    mapsQuery: "El Paso County Coliseum, 4100 E Paisano Dr, El Paso, TX",
    partner: "El Paso County Coliseum",
    note: "Free admission",
    blurb:
      "Trick or treat yourself to a new hat! BBQ cook-off, vendors, music, trick-or-treating and a pet costume contest. Come in costume and build your hat with us.",
  },
  {
    id: "wine-not-add-a-hat",
    kicker: "El Paso Wine & Food Festival",
    title: "Wine Not Add a Hat?",
    sessions: [
      { date: "2026-11-06", day: "Friday, November 6", time: "5 PM TO 7:30 PM", start: "17:00", end: "19:30" },
      { date: "2026-11-07", day: "Saturday, November 7", time: "1 PM TO 4 PM", start: "13:00", end: "16:00" },
    ],
    place: "El Paso Wine & Food Festival",
    blurb:
      "We're bringing the hat bar to the El Paso Wine & Food Festival! Sip, savor and build your custom hat with us. Grab your girls and come see us.",
  },
  {
    id: "beers-bites-brims",
    kicker: "Pop-up at Deadbeach Brewery",
    title: "Beers, Bites & Brims",
    sessions: [{ date: "2026-11-07", day: "Saturday, November 7", time: "Starting at 4:00 PM", start: "16:00" }],
    place: "Deadbeach Brewery",
    mapsQuery: "Deadbeach Brewery, El Paso, TX",
    blurb:
      "We're popping up at Deadbeach Brewery! Grab a cold one, order something good and build your custom hat with us while you're at it.",
  },
  {
    id: "saddle-and-sculpt",
    kicker: "Saddle & Sculpt",
    title: "Read All About It",
    sessions: [{ date: "2026-11-08", day: "Sunday, November 8", time: "9 AM TO 12 PM", start: "09:00", end: "12:00" }],
    place: "Broken Arrow Arena",
    mapsQuery: "Broken Arrow Arena",
    partner: "Obsidian Barre & Wellness",
    note: "Ticketed event, spots are limited",
    blurb:
      "Horses, pilates and custom hats in one morning. We're teaming up with Obsidian Barre & Wellness for an experience you don't want to miss.",
  },
  {
    id: "brims-and-blowouts",
    kicker: "Save the date",
    title: "Brims & Blowouts",
    sessions: [{ date: "2026-11-14", day: "Saturday, November 14" }],
    place: "Nashville Blonde",
    partner: "Nashville Blonde",
    note: "Tickets and details coming soon",
    blurb:
      "A fresh blowout plus a custom hat is the perfect combo. We're teaming up with Nashville Blonde for a ticketed event full of good hair, good hats and good company.",
  },
  {
    id: "boots-and-buckles",
    kicker: "Boots & Buckles Country Market",
    title: "The Hat Bar Is Coming",
    sessions: [{ date: "2026-11-15", day: "Sunday, November 15", time: "11 AM TO 3 PM", start: "11:00", end: "15:00" }],
    place: "Mesa Plaza, in front of Hobby Lobby West",
    mapsQuery: "Hobby Lobby, Mesa Plaza, El Paso, TX",
    partner: "Upper Valley Market",
    blurb:
      "We're bringing the hat bar to the Upper Valley! Pick your hat, customize your look and enjoy live country music by the West Texas Country Band.",
  },
];

/** Today's date (YYYY-MM-DD) where the events happen, not where the visitor is. */
export function todayInEventZone(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: EVENT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

const firstSession = (e) => e.sessions[0];
const lastDate = (e) => e.sessions[e.sessions.length - 1].date;
const sortKey = (e) => `${firstSession(e).date} ${firstSession(e).start || "00:00"}`;

/** Events still on (through their last day), soonest first. */
export function upcomingEvents(list = UPCOMING_EVENTS, now = new Date()) {
  const today = todayInEventZone(now);
  return list.filter((e) => lastDate(e) >= today).sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
}

/** Google Maps search link, or null when the event has no reliable address. */
export function directionsUrl(event) {
  return event.mapsQuery
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.mapsQuery)}`
    : null;
}

const plusHours = (hhmm, h) => {
  const [hr, mn] = hhmm.split(":").map(Number);
  return `${String(Math.min(hr + h, 23)).padStart(2, "0")}:${String(mn).padStart(2, "0")}`;
};

/** A prefilled Google Calendar link for one session, in the event's time zone. */
export function calendarUrl(event, session = firstSession(event)) {
  const day = session.date.replace(/-/g, "");
  let dates;
  if (session.start) {
    const t = (hhmm) => hhmm.replace(":", "") + "00";
    dates = `${day}T${t(session.start)}/${day}T${t(session.end || plusHours(session.start, 2))}`;
  } else {
    // time not announced yet: an all day entry (Google's end date is exclusive)
    const next = new Date(`${session.date}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    dates = `${day}/${next.toISOString().slice(0, 10).replace(/-/g, "")}`;
  }
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Tippin' Cowgirl Hat Bar: ${event.title}`,
    dates,
    ctz: EVENT_TIME_ZONE,
    location: event.place,
    details: `${event.blurb}\n\nhttps://tippincowgirl.com/events`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
