// ---------------------------------------------------------------------------
// Upcoming hat bar events (pop-ups, markets, collabs). Shown on /events and,
// the next two, on the landing. An event disappears on its own the day after
// its date, so nobody has to remember to take it down.
//
// To add one: append an entry and drop its flyer as
// src/assets/upcoming/<id>.webp (portrait 3:4, about 900 px wide). Without a
// flyer the card still renders, just without the image.
//
//   date       YYYY-MM-DD, the day of the event (Mountain Time)
//   start/end  24 h "HH:MM", used for "Add to calendar"
//   timeLabel  what people read; ranges use "TO", never a dash
//   mapsQuery  what Google Maps searches for "Get directions"
// ---------------------------------------------------------------------------

export const EVENT_TIME_ZONE = "America/Denver";

export const UPCOMING_EVENTS = [
  {
    id: "back-on-the-farm",
    kicker: "After the rain",
    title: "Back on the Farm",
    date: "2026-10-17",
    dateLabel: "Saturday, October 17",
    start: "10:00",
    end: "16:00",
    timeLabel: "10:00 AM TO 4:00 PM",
    place: "Valley Farms NM Farm Store",
    mapsQuery: "Valley Farms NM Farm Store",
    blurb:
      "After the rain, we're finally making it happen! Come build your hat with us at the sweetest little farm store.",
  },
  {
    id: "boots-and-buckles",
    kicker: "Boots & Buckles Country Market",
    title: "The Hat Bar Is Coming",
    date: "2026-11-15",
    dateLabel: "Sunday, November 15",
    start: "11:00",
    end: "15:00",
    timeLabel: "11 AM TO 3 PM",
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

/** Events from today on, soonest first. */
export function upcomingEvents(list = UPCOMING_EVENTS, now = new Date()) {
  const today = todayInEventZone(now);
  return list.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date));
}

/** Google Maps search link for an event's place. */
export function directionsUrl(event) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.mapsQuery || event.place)}`;
}

/** A prefilled Google Calendar "add event" link, in the event's own time zone. */
export function calendarUrl(event) {
  const day = event.date.replace(/-/g, "");
  const t = (hhmm) => hhmm.replace(":", "") + "00";
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Tippin' Cowgirl Hat Bar: ${event.title}`,
    dates: `${day}T${t(event.start)}/${day}T${t(event.end)}`,
    ctz: EVENT_TIME_ZONE,
    location: event.place,
    details: `${event.blurb}\n\nhttps://tippincowgirl.com/events`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
