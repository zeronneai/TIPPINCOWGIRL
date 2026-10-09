// ---------------------------------------------------------------------------
// One-off: bring the booking requests already in the Google Sheet into the
// staff portal.
//
//   npm run import:bookings                          data/bookings.csv
//   npm run import:bookings -- path/to/file.csv
//   npm run import:bookings -- --dry-run             read and show, write nothing
//   npm run import:bookings -- --tz=America/Chicago  the Sheet's time zone
//
// Export the Sheet as CSV (File > Download > Comma separated values) into
// data/, which is gitignored: it holds customer contact details and must
// never be committed. The columns, in any order, matched by name:
//
//   Timestamp  day/month/year hour:minute:second, in the Sheet's time zone
//              (America/Denver unless --tz says otherwise; El Paso is
//              Mountain Time)
//   name, email, phone, eventType, eventDate (YYYY-MM-DD), notes
//
// Blank fields stay empty. Every row goes in as status "new" with source
// "sheet-import", and its first history line dated when it was sent.
//
// SAFE TO RUN AGAIN: a row is skipped when a booking with the same email,
// event date and sent time is already there. A row that cannot be read (no
// name, a timestamp or date in another format) is skipped and listed with
// its line number and the reason; the rest still go in.
//
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (not for --dry-run).
// It always prints what it is about to do first and the result last, never
// prints a key, and runs on Windows too (scripts/lib/cli.js).
// ---------------------------------------------------------------------------

import { readFileSync } from "node:fs";
import { isoDate } from "../api/_lib/bookings.js";
import { isDirectRun, listNames, projectHost, redact } from "./lib/cli.js";

export const DEFAULT_CSV = "data/bookings.csv";
export const DEFAULT_TZ = "America/Denver";
const COLUMNS = { timestamp: "Timestamp", name: "name", email: "email", phone: "phone", eventtype: "eventType", eventdate: "eventDate", notes: "notes" };

/** RFC 4180 CSV: quoted fields, doubled quotes, commas and newlines inside quotes, CRLF, a BOM. */
export function parseCsv(text) {
  const s = String(text ?? "").replace(/^﻿/, "");
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"' && field === "") quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  // drop fully empty lines (a trailing newline, blank rows in the export)
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** Minutes the time zone is ahead of UTC at a given instant. */
function offsetMinutes(utcMs, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(new Date(utcMs))
      .map((p) => [p.type, p.value])
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return Math.round((asUtc - utcMs) / 60000);
}

/**
 * The Sheet's "14/11/2026 9:05:07" (day/month/year, local to `timeZone`)
 * as an ISO instant, or null when it is not a real date and time.
 */
export function parseSheetTimestamp(text, timeZone = DEFAULT_TZ) {
  const m = String(text ?? "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const [d, mo, y, h, mi, sec = "0"] = m.slice(1);
  const [D, M, Y, H, MI, S] = [d, mo, y, h, mi, sec].map(Number);
  const probe = new Date(Date.UTC(Y, M - 1, D, H, MI, S));
  if (probe.getUTCFullYear() !== Y || probe.getUTCMonth() !== M - 1 || probe.getUTCDate() !== D || H > 23 || MI > 59 || S > 59) return null;
  // local wall time to UTC: guess, then correct by the zone's offset (twice, for DST edges)
  let utc = probe.getTime();
  try {
    utc -= offsetMinutes(utc, timeZone) * 60000;
    utc = probe.getTime() - offsetMinutes(utc, timeZone) * 60000;
  } catch {
    return null;
  }
  return new Date(utc).toISOString();
}

const text = (v) => {
  const s = String(v ?? "").replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, " ").trim();
  return s === "" ? null : s;
};

/** The CSV as booking rows, plus the lines that cannot be read. */
export function readBookings(csvText, { timeZone = DEFAULT_TZ } = {}) {
  const [header, ...lines] = parseCsv(csvText);
  if (!header) throw new Error("the file is empty");
  const index = {};
  header.forEach((h, i) => {
    const key = String(h).trim().toLowerCase().replace(/[\s_]/g, "");
    if (COLUMNS[key] && index[key] === undefined) index[key] = i;
  });
  const missing = ["timestamp", "name"].filter((k) => index[k] === undefined).map((k) => COLUMNS[k]);
  if (missing.length) throw new Error(`the header has no ${listNames(missing)} column (found: ${header.join(", ")})`);

  const rows = [];
  const unreadable = [];
  lines.forEach((cells, i) => {
    const line = i + 2; // 1 is the header
    const get = (k) => (index[k] === undefined ? null : text(cells[index[k]]));
    const created = parseSheetTimestamp(get("timestamp"), timeZone);
    const rawDate = get("eventdate");
    const eventDate = rawDate ? isoDate(rawDate) : null;
    const name = get("name");
    const reasons = [];
    if (!created) reasons.push(`Timestamp "${get("timestamp") ?? ""}" is not day/month/year hour:minute:second`);
    if (rawDate && !eventDate) reasons.push(`eventDate "${rawDate}" is not YYYY-MM-DD`);
    if (!name) reasons.push("no name");
    if (reasons.length) return unreadable.push({ line, reason: reasons.join("; ") });
    rows.push({
      line,
      row: {
        created_at: created,
        name,
        email: get("email")?.toLowerCase() ?? null,
        phone: get("phone"),
        event_type: get("eventtype"),
        event_date: eventDate,
        notes: get("notes"),
        status: "new",
        source: "sheet-import",
      },
    });
  });
  return { rows, unreadable };
}

const keyOf = (r) => `${r.email ?? ""}|${r.event_date ?? ""}|${r.created_at}`;

/** Is this booking (same email, event date and sent time) already stored? */
async function exists(db, r) {
  let q = db.from("bookings").select("id").eq("created_at", r.created_at).limit(1);
  q = r.email ? q.eq("email", r.email) : q.is("email", null);
  q = r.event_date ? q.eq("event_date", r.event_date) : q.is("event_date", null);
  const { data, error } = await q;
  if (error) throw Object.assign(new Error(error.message), { code: error.code });
  return data.length > 0;
}

/**
 * Insert what is missing. Never throws for one bad row; a database refusal
 * stops the run (the summary says how far it got).
 *
 * @returns {Promise<{inserted: number, existing: number, unreadable: number, wouldInsert: number}>}
 */
export async function importBookings({ csvText, db, dryRun = false, timeZone = DEFAULT_TZ, log = console.log }) {
  const { rows, unreadable } = readBookings(csvText, { timeZone });
  const totals = { inserted: 0, existing: 0, unreadable: unreadable.length, wouldInsert: 0 };
  for (const u of unreadable) log(`skipped line ${u.line}: ${u.reason}`);

  const seen = new Set();
  for (const { line, row } of rows) {
    const key = keyOf(row);
    if (seen.has(key)) {
      totals.existing += 1;
      log(`skipped line ${line}: the same request appears earlier in the file`);
      continue;
    }
    seen.add(key);
    if (dryRun) {
      totals.wouldInsert += 1;
      log(`  line ${line}: ${row.created_at.slice(0, 10)}  ${row.name}  ${row.event_type || "no type"}  ${row.event_date || "no date"}`);
      continue;
    }
    if (await exists(db, row)) {
      totals.existing += 1;
      continue;
    }
    const { data, error } = await db.from("bookings").insert(row).select("id");
    if (error) throw Object.assign(new Error(`line ${line} refused: ${error.message}`), { code: error.code, totals });
    await db
      .from("booking_events")
      .insert({ booking_id: data[0].id, actor_email: "sheet-import", from_status: null, to_status: "new", note: "Imported from the Google Sheet", created_at: row.created_at });
    totals.inserted += 1;
  }
  return totals;
}

/**
 * The whole command, outputs passed in. Always prints a first line and a
 * last line, and returns the exit code.
 */
export async function main({ argv = process.argv, env = process.env, out = console.log, err = console.error, connect, readFile = (p) => readFileSync(p, "utf8") } = {}) {
  const args = argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const tzArg = args.find((a) => a.startsWith("--tz="));
  const timeZone = tzArg ? tzArg.slice(5) : DEFAULT_TZ;
  const file = args.find((a) => !a.startsWith("--")) || DEFAULT_CSV;
  out(`Import bookings${dryRun ? " (dry run, nothing is written)" : ""}: reading ${file}, times in ${timeZone}.`);

  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
  } catch {
    err(`Failed: "${timeZone}" is not a time zone (for example --tz=America/Denver). Nothing was changed.`);
    return 1;
  }
  let csvText;
  try {
    csvText = readFile(file);
  } catch (e) {
    err(`Failed: cannot read ${file} (${e.code === "ENOENT" ? "no such file" : e.message}). Export the Sheet as CSV into data/bookings.csv or pass its path. Nothing was changed.`);
    return 1;
  }
  const missing = dryRun ? [] : ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"].filter((k) => !env[k]);
  if (missing.length) {
    // names only, never values
    err(`Missing ${listNames(missing)}. Set ${missing.length > 1 ? "them" : "it"} in .env (or the shell) and run it again. Nothing was changed.`);
    return 1;
  }

  let db = null;
  try {
    if (!dryRun) {
      if (connect) db = connect(env);
      else {
        const { createClient } = await import("@supabase/supabase-js");
        db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
      }
      out(`Supabase project: ${projectHost(env.SUPABASE_URL)}`);
    }
    const t = await importBookings({ csvText, db, dryRun, timeZone, log: out });
    const skipped = t.existing + t.unreadable;
    out(
      dryRun
        ? `Dry run: ${t.wouldInsert} bookings would be inserted (any already in the portal are skipped), ${t.unreadable} unreadable. Nothing was written.`
        : `Done: ${t.inserted} inserted, ${skipped} skipped (${t.existing} already in the portal, ${t.unreadable} unreadable).`
    );
    return 0;
  } catch (e) {
    const sofar = e.totals ? ` after ${e.totals.inserted} inserted` : "";
    err(`Failed${sofar}: ${redact(e.message)}${e.code ? ` (code ${e.code})` : ""}`);
    return 1;
  }
}

// exitCode, not exit(): on Windows a pipe is written asynchronously and
// process.exit() can cut the last lines off.
if (isDirectRun(import.meta.url)) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (e) => {
      console.error(`Failed: ${redact(e?.message || e)}`);
      process.exitCode = 1;
    }
  );
}
