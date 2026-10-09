// ---------------------------------------------------------------------------
// POST /api/booking
//
// The staff portal's copy of a "Book the bar" request. The form keeps
// posting to the Google Apps Script exactly as before (the Sheet, and
// whatever that script does); this is a second, independent request from
// the same submit, made fire and forget (src/booking/mirror.js). Nothing
// here decides what the visitor sees.
//
// So this endpoint never fails loudly: a database error is logged with the
// reason and answered 200 { ok: true, stored: false }. Only a body that is
// not a booking at all gets a 400, and a filled honeypot gets a quiet 200
// with nothing stored, so a bot learns nothing.
//
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   server only, as for orders.
//   Without them the request is accepted and not stored (logged).
// ---------------------------------------------------------------------------

import { cleanBooking, saveBooking } from "./_lib/bookings.js";

const MAX_BODY_BYTES = 8 * 1024;

function readBody(req) {
  const b = req.body;
  if (b && typeof b === "object" && !Buffer.isBuffer(b)) return b;
  const text = Buffer.isBuffer(b) ? b.toString("utf8") : typeof b === "string" ? b : "";
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  const length = Number(req.headers?.["content-length"] || 0);
  if (length > MAX_BODY_BYTES) return res.status(413).json({ ok: false, error: "Too large" });

  const body = readBody(req);
  if (!body) return res.status(400).json({ ok: false, error: "Invalid request" });

  const result = cleanBooking(body);
  if (result.spam) return res.status(200).json({ ok: true });
  if (!result.ok) return res.status(400).json({ ok: false, errors: result.errors });

  try {
    const saved = await saveBooking(result.row);
    if (!saved.saved) {
      console.warn("[booking] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing, a booking request was not stored.");
      return res.status(200).json({ ok: true, stored: false });
    }
    return res.status(200).json({ ok: true, stored: true, duplicate: !!saved.duplicate });
  } catch (err) {
    // Logged for us, never thrown at the visitor. The Sheet has the request.
    console.error("[booking] could not store a booking request:", err?.message || err);
    return res.status(200).json({ ok: true, stored: false });
  }
}
