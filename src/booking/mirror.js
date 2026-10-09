// ---------------------------------------------------------------------------
// The staff portal's copy of a booking request (POST /api/booking).
//
// Fire and forget, on purpose. The booking form's real send is still the
// Google Apps Script request in App.jsx, untouched: it writes the Sheet and
// decides what the visitor sees. This copy is never awaited, never throws,
// and its failure, slowness or absence changes nothing for the visitor or
// for the Sheet. keepalive lets it finish even if the drawer closes.
// ---------------------------------------------------------------------------

export const BOOKING_COPY_URL = "/api/booking";

/** Send the copy. Returns nothing, whatever happens. */
export function mirrorBooking(payload, fetchImpl = typeof fetch === "function" ? fetch : null) {
  try {
    if (!fetchImpl) return;
    const pending = fetchImpl(BOOKING_COPY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
    if (pending && typeof pending.catch === "function") pending.catch(() => {});
  } catch {
    /* the copy is a nice to have: never let it reach the form */
  }
}
