import { test } from "node:test";
import assert from "node:assert/strict";
import { UPCOMING_EVENTS, calendarUrl, directionsUrl, todayInEventZone, upcomingEvents } from "../src/events/upcoming.js";

const ev = (id, ...dates) => ({
  id,
  title: id,
  place: "Somewhere",
  blurb: "b",
  sessions: dates.map((date) => ({ date, day: date, start: "10:00", end: "16:00" })),
});

test("an event stays listed through its last day in Mountain Time, then drops", () => {
  const list = [ev("a", "2026-10-17")];
  // 11 pm in El Paso on the 17th is already the 18th in UTC
  assert.equal(upcomingEvents(list, new Date("2026-10-18T05:00:00Z")).length, 1);
  assert.equal(upcomingEvents(list, new Date("2026-10-18T07:00:00Z")).length, 0);
});

test("a two day event stays until its second day is over", () => {
  const list = [ev("fest", "2026-11-06", "2026-11-07")];
  assert.equal(upcomingEvents(list, new Date("2026-11-07T18:00:00Z")).length, 1);
  assert.equal(upcomingEvents(list, new Date("2026-11-08T08:00:00Z")).length, 0);
});

test("events are sorted by first day, then start time", () => {
  const late = ev("late", "2026-12-01");
  const afternoon = { ...ev("afternoon", "2026-11-01"), sessions: [{ date: "2026-11-01", day: "x", start: "14:00" }] };
  const morning = ev("morning", "2026-11-01");
  assert.deepEqual(
    upcomingEvents([late, afternoon, morning], new Date("2026-10-01T12:00:00Z")).map((e) => e.id),
    ["morning", "afternoon", "late"],
  );
});

test("todayInEventZone uses the event time zone", () => {
  assert.equal(todayInEventZone(new Date("2026-10-18T03:00:00Z")), "2026-10-17");
});

test("calendar links: timed, start only and all day sessions", () => {
  const e = ev("a", "2026-10-17");
  assert.equal(new URL(calendarUrl(e)).searchParams.get("dates"), "20261017T100000/20261017T160000");
  assert.equal(new URL(calendarUrl(e)).searchParams.get("ctz"), "America/Denver");
  const startOnly = { date: "2026-11-07", day: "x", start: "16:00" };
  assert.equal(new URL(calendarUrl(e, startOnly)).searchParams.get("dates"), "20261107T160000/20261107T180000");
  const allDay = { date: "2026-11-30", day: "x" };
  assert.equal(new URL(calendarUrl(e, allDay)).searchParams.get("dates"), "20261130/20261201");
});

test("directions only when there is a maps query", () => {
  assert.match(directionsUrl({ mapsQuery: "Hobby Lobby, Mesa Plaza" }), /query=Hobby%20Lobby%2C%20Mesa%20Plaza/);
  assert.equal(directionsUrl({ place: "Somewhere" }), null);
});

test("every real event is complete and its copy has no long dashes", () => {
  for (const e of UPCOMING_EVENTS) {
    for (const k of ["id", "kicker", "title", "place", "blurb"]) assert.ok(e[k], `${e.id} is missing ${k}`);
    assert.ok(e.sessions?.length, `${e.id} has no sessions`);
    for (const s of e.sessions) {
      assert.match(s.date, /^\d{4}-\d{2}-\d{2}$/, `${e.id} date`);
      assert.ok(s.day, `${e.id} day label`);
      if (s.start) assert.match(s.start, /^\d{2}:\d{2}$/);
    }
    assert.ok(!/[–—]/.test(JSON.stringify(e)), `${e.id} has a long dash`);
  }
});
