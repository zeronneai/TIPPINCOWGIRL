// ---------------------------------------------------------------------------
// Vercel Web Analytics: page visits, no cookies.
//
// Every event goes through scrubEvent() before it leaves the browser. The
// site's addresses can carry things that are nobody's business but the
// customer's: the builder permalink holds her free text stitching note
// (?sn=...), and the order confirmation holds the Stripe session id
// (?session_id=...). So the whole query string is dropped, except campaign
// tags (utm_*), which only say which post or ad brought her here.
//
// Privacy (src/components/TrustPages.jsx) describes exactly this; change the
// two together.
// ---------------------------------------------------------------------------

/** Keep the path and any utm_* tags; drop every other query parameter and the hash. */
export function scrubUrl(url) {
  try {
    const u = new URL(url);
    const kept = new URLSearchParams();
    for (const [k, v] of u.searchParams) if (/^utm_/i.test(k)) kept.append(k, v);
    const qs = kept.toString();
    return `${u.origin}${u.pathname}${qs ? `?${qs}` : ""}`;
  } catch {
    return null;
  }
}

/** beforeSend middleware: scrubbed event, or null to drop one we cannot read. */
export function scrubEvent(event) {
  const url = scrubUrl(event?.url);
  return url ? { ...event, url } : null;
}
