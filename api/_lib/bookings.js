// ---------------------------------------------------------------------------
// Booking requests in the staff portal's database (Supabase), server side.
//
// SERVER ONLY, like orders.js next to it: the service role key bypasses Row
// Level Security, is read from SUPABASE_SERVICE_ROLE_KEY (never VITE_), and
// this folder's leading underscore keeps Vercel from publishing it.
//
// The browser's own checks (validateBooking in App.jsx) are only a courtesy
// to the visitor. These are the ones that decide what is stored: every
// field trimmed, control characters out, lengths capped, the email checked,
// the date a real calendar date, and the honeypot respected.
// ---------------------------------------------------------------------------

import { supabaseAdmin } from "./orders.js";

// Same caps as the form (FIELD_LIMITS in App.jsx).
export const BOOKING_LIMITS = { name: 80, email: 120, phone: 40, eventType: 40, eventDate: 10, notes: 1000 };
export const BOOKING_STATUSES = ["new", "confirmed", "declined", "rescheduled", "completed"];

// Permissive like the form's: catch typos, not exotic but real addresses.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Text as stored: control characters out, whitespace collapsed, trimmed. */
const clean = (v, max, { multiline = false } = {}) => {
  let s = String(v ?? "");
  s = multiline ? s.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, " ") : s.replace(/[\u0000-\u001f\u007f]/g, " ");
  s = multiline ? s.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n") : s.replace(/\s+/g, " ");
  s = s.trim();
  return { value: s, tooLong: s.length > max };
};

/** "2026-11-14" when it is a real date, else null. */
export function isoDate(v) {
  const s = String(v ?? "").trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [y, mo, d] = m.slice(1).map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d ? s : null;
}

/**
 * The form body as a bookings row, or the reasons it is refused.
 *
 * @returns {{spam: true} | {ok: true, row: object} | {ok: false, errors: object}}
 */
export function cleanBooking(body) {
  const b = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  // A person never sees the "company" field; a bot fills every field.
  if (String(b.company ?? "").trim()) return { spam: true };

  const errors = {};
  const name = clean(b.name, BOOKING_LIMITS.name);
  const email = clean(b.email, BOOKING_LIMITS.email);
  const phone = clean(b.phone, BOOKING_LIMITS.phone);
  const eventType = clean(b.eventType, BOOKING_LIMITS.eventType);
  const notes = clean(b.notes, BOOKING_LIMITS.notes, { multiline: true });
  const rawDate = String(b.eventDate ?? "").trim();

  if (!name.value) errors.name = "required";
  else if (name.tooLong) errors.name = `longer than ${BOOKING_LIMITS.name} characters`;
  if (!email.value) errors.email = "required";
  else if (email.tooLong) errors.email = `longer than ${BOOKING_LIMITS.email} characters`;
  else if (!EMAIL.test(email.value)) errors.email = "not a valid email";
  if (phone.tooLong) errors.phone = `longer than ${BOOKING_LIMITS.phone} characters`;
  if (!eventType.value) errors.eventType = "required";
  else if (eventType.tooLong) errors.eventType = `longer than ${BOOKING_LIMITS.eventType} characters`;
  if (notes.tooLong) errors.notes = `longer than ${BOOKING_LIMITS.notes} characters`;
  const eventDate = rawDate ? isoDate(rawDate) : null;
  if (rawDate && !eventDate) errors.eventDate = "not a date (YYYY-MM-DD)";

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    row: {
      name: name.value,
      email: email.value.toLowerCase(),
      phone: phone.value || null,
      event_type: eventType.value,
      event_date: eventDate,
      notes: notes.value || null,
      source: "website",
    },
  };
}

// A visitor who sees an error from the Sheet and presses send again would
// otherwise create a twin. The same email, type and date within this
// window counts as the same request.
export const DUPLICATE_WINDOW_MINUTES = 30;

/**
 * Store one booking (already cleaned). Writes the first history row too.
 *
 * @returns {Promise<{saved: boolean, inserted?: boolean, id?: string|null, duplicate?: boolean}>}
 * @throws when the database refuses (the caller logs it, the visitor never sees it)
 */
export async function saveBooking(row, client = supabaseAdmin(), { now = Date.now() } = {}) {
  if (!client) return { saved: false };

  const since = new Date(now - DUPLICATE_WINDOW_MINUTES * 60000).toISOString();
  let dup = client.from("bookings").select("id").eq("email", row.email).eq("event_type", row.event_type).gte("created_at", since).limit(1);
  dup = row.event_date ? dup.eq("event_date", row.event_date) : dup.is("event_date", null);
  const { data: twins, error: dupError } = await dup;
  if (dupError) throw new Error(`bookings lookup failed: ${dupError.message}`);
  if (twins?.length) return { saved: true, inserted: false, duplicate: true, id: twins[0].id };

  const { data, error } = await client.from("bookings").insert(row).select("id");
  if (error) throw new Error(`bookings insert failed: ${error.message}`);
  const id = data?.[0]?.id ?? null;

  const { error: eventError } = await client
    .from("booking_events")
    .insert({ booking_id: id, actor_email: "website", from_status: null, to_status: "new", note: "Requested on the website" });
  if (eventError) console.warn(`[booking] booking ${id} stored, its first history row was not: ${eventError.message}`);
  return { saved: true, inserted: true, id };
}
