// ---------------------------------------------------------------------------
// Four demo booking requests for trying the portal's Bookings section.
//
//   npm run seed:demo-bookings            add them
//   npm run seed:demo-bookings:delete     remove them
//
// Run by hand only, on a test project. Needs SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY, refuses to run when NODE_ENV is "production".
// Every demo booking has an email ending in @demo.tippin and source "demo",
// which is how --delete finds them (their history goes with them). Running
// it twice adds nothing new: a demo email already there is left alone.
//
// Like the orders seed, it always prints what it is about to do first and
// the result last (or the exact error), never prints a key, and runs on
// Windows too (scripts/lib/cli.js).
// ---------------------------------------------------------------------------

import { createClient } from "@supabase/supabase-js";
import { isDirectRun, listNames, projectHost, redact } from "./lib/cli.js";
import { DEMO_EMAIL_SUFFIX } from "./seed-demo-orders.js";

const DAY = 86400000;
const dayFromNow = (n, now) => new Date(now + n * DAY).toISOString().slice(0, 10);

// event dates are relative to today, so the calendar always has something to show
export const DEMO_BOOKINGS = [
  {
    name: "Jasmine Ortega",
    email: `jasmine.ortega${DEMO_EMAIL_SUFFIX}`,
    phone: "915-555-0141",
    event_type: "Bachelorette",
    eventIn: 24,
    notes: "About 12 girls, would love pink and white felt options. Saturday afternoon if possible.",
    sentAgo: 0.1,
    status: "new",
  },
  {
    name: "Rachel Kim",
    email: `rachel.kim${DEMO_EMAIL_SUFFIX}`,
    phone: "915-555-0177",
    event_type: "Corporate",
    eventIn: 12,
    notes: "Team offsite at the Plaza Hotel, 40 people, two hours.",
    sentAgo: 6,
    status: "confirmed",
    history: [["confirmed", "Deposit received by Zelle. Arrive 1 hour early to set up."]],
    internal: "Loading dock on the west side. Contact on site: Rachel.",
  },
  {
    name: "Sofia Delgado",
    email: `sofia.delgado${DEMO_EMAIL_SUFFIX}`,
    phone: null,
    event_type: "Birthday",
    eventIn: 5,
    proposedIn: 19,
    notes: "My mom's 60th, she loves turquoise.",
    sentAgo: 9,
    status: "rescheduled",
    history: [["rescheduled", null]],
  },
  {
    name: "Taylor Brooks",
    email: `taylor.brooks${DEMO_EMAIL_SUFFIX}`,
    phone: "512-555-0109",
    event_type: "Wedding",
    eventIn: 3,
    notes: "Reception in Austin, could you travel?",
    sentAgo: 15,
    status: "declined",
    history: [["declined", "Already booked in El Paso that weekend."]],
  },
];

export function demoRows(now = Date.now()) {
  return DEMO_BOOKINGS.map((d) => ({
    created_at: new Date(now - d.sentAgo * DAY).toISOString(),
    name: d.name,
    email: d.email,
    phone: d.phone,
    event_type: d.event_type,
    event_date: dayFromNow(d.eventIn, now),
    proposed_date: d.proposedIn ? dayFromNow(d.proposedIn, now) : null,
    notes: d.notes,
    status: d.status,
    internal_notes: d.internal || null,
    source: "demo",
  }));
}

const describe = (error) => redact([error?.message || String(error), error?.code ? `(code ${error.code})` : "", error?.hint ? `Hint: ${error.hint}` : ""].filter(Boolean).join(" "));

/** The whole command, outputs passed in; always a first and a last line. Returns the exit code. */
export async function main({ argv = process.argv, env = process.env, out = console.log, err = console.error, connect, now = Date.now() } = {}) {
  const remove = argv.includes("--delete");
  out(
    remove
      ? `Seed demo bookings: deleting every booking whose email ends in ${DEMO_EMAIL_SUFFIX}.`
      : `Seed demo bookings: adding ${DEMO_BOOKINGS.length} demo booking requests (emails ending in ${DEMO_EMAIL_SUFFIX}).`
  );
  if (env.NODE_ENV === "production") {
    err("Refusing to run: NODE_ENV is production. Demo bookings are for a test project.");
    return 1;
  }
  const missing = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"].filter((k) => !env[k]);
  if (missing.length) {
    err(`Missing ${listNames(missing)}. Set ${missing.length > 1 ? "them" : "it"} in .env (or the shell) and run it again. Nothing was changed.`);
    return 1;
  }
  out(`Supabase project: ${projectHost(env.SUPABASE_URL)}`);
  try {
    const db = connect ? connect(env) : createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    if (remove) {
      const { data, error } = await db.from("bookings").delete().like("email", `%${DEMO_EMAIL_SUFFIX}`).select("id");
      if (error) throw Object.assign(new Error(`Supabase refused the delete: ${describe(error)}`), { described: true });
      out(`Done: deleted ${data.length} demo booking${data.length === 1 ? "" : "s"} (and their history).`);
      return 0;
    }
    let added = 0;
    let existing = 0;
    for (const [i, row] of demoRows(now).entries()) {
      const { data: found, error: findError } = await db.from("bookings").select("id").eq("email", row.email).limit(1);
      if (findError) throw Object.assign(new Error(`Supabase refused the lookup: ${describe(findError)}`), { described: true });
      if (found.length) {
        existing += 1;
        out(`  already there: ${row.name}`);
        continue;
      }
      const { data, error } = await db.from("bookings").insert(row).select("id");
      if (error) throw Object.assign(new Error(`Supabase refused ${row.name}'s booking after ${added} added: ${describe(error)}`), { described: true });
      const created = Date.parse(row.created_at);
      const events = [{ actor_email: "website", from_status: null, to_status: "new", note: "Requested on the website", created_at: row.created_at }];
      (DEMO_BOOKINGS[i].history || []).forEach(([to, note], k) =>
        events.push({
          actor_email: `deborah${DEMO_EMAIL_SUFFIX}`,
          from_status: k === 0 ? "new" : DEMO_BOOKINGS[i].history[k - 1][0],
          to_status: to,
          note: note ?? (to === "rescheduled" ? `Proposed date: ${row.proposed_date}` : null),
          created_at: new Date(Math.min(created + (k + 1) * 0.2 * DAY, now)).toISOString(),
        })
      );
      const { error: evError } = await db.from("booking_events").insert(events.map((e) => ({ ...e, booking_id: data[0].id })));
      if (evError) throw Object.assign(new Error(`Supabase stored ${row.name}'s booking but refused its history: ${describe(evError)}`), { described: true });
      added += 1;
      out(`  added: ${row.name} (${row.status})`);
    }
    out(`Done: ${added} demo booking${added === 1 ? "" : "s"} added, ${existing} already there. Remove them with: npm run seed:demo-bookings:delete`);
    return 0;
  } catch (e) {
    err(`Failed: ${e.described ? e.message : describe(e)}`);
    return 1;
  }
}

if (isDirectRun(import.meta.url)) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (e) => {
      console.error(`Failed: ${describe(e)}`);
      process.exitCode = 1;
    }
  );
}
