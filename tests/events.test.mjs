import { test } from "node:test";
import assert from "node:assert/strict";
import { UPCOMING_EVENTS, calendarUrl, directionsUrl, todayInEventZone, upcomingEvents } from "../src/events/upcoming.js";

const ev = (id, date) => ({ id, date, start: "10:00", end: "16:00", place: "Somewhere", blurb: "b", title: id });

test("an event stays listed through its own day in Mountain Time, then drops", () => {
  const list = [ev("a", "2026-10-17")];
  // 11 pm in El Paso on the 17th is already the 18th in UTC
  assert.equal(upcomingEvents(list, new Date("2026-10-18T05:00:00Z")).length, 1);
  assert.equal(upcomingEvents(list, new Date("2026-10-18T07:00:00Z")).length, 0);
});

test("upcoming events are sorted soonest first", () => {
  const list = [ev("late", "2026-12-01"), ev("soon", "2026-11-01")];
  assert.deepEqual(upcomingEvents(list, new Date("2026-10-01T12:00:00Z")).map((e) => e.id), ["soon", "late"]);
});

test("todayInEventZone uses the event time zone", () => {
  assert.equal(todayInEventZone(new Date("2026-10-18T03:00:00Z")), "2026-10-17");
});

test("calendar and directions links carry the event details", () => {
  const url = new URL(calendarUrl(ev("a", "2026-10-17")));
  assert.equal(url.searchParams.get("dates"), "20261017T100000/20261017T160000");
  assert.equal(url.searchParams.get("ctz"), "America/Denver");
  assert.match(directionsUrl({ place: "Mesa Plaza", mapsQuery: "Hobby Lobby, Mesa Plaza" }), /query=Hobby%20Lobby%2C%20Mesa%20Plaza/);
});

test("every real event is complete and its copy has no long dashes", () => {
  for (const e of UPCOMING_EVENTS) {
    for (const k of ["id", "kicker", "title", "date", "dateLabel", "start", "end", "timeLabel", "place", "blurb"])
      assert.ok(e[k], `${e.id} is missing ${k}`);
    assert.match(e.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(!/[–—]/.test(JSON.stringify(e)), `${e.id} has a long dash`);
  }
});
