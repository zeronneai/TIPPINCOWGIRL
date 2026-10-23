// ---------------------------------------------------------------------------
// Meta Pixel (1181218101009775), for Instagram and Facebook ads.
//
// Loaded only on public pages (never the staff portal, see App.jsx), and the
// script itself only once, on the first event. Events:
//   PageView          every page, including pushState navigation
//   Contact           a tap on a phone, email or WhatsApp link
//   Lead              a booking request or a giveaway entry that went through
//   InitiateCheckout  the cart sends the customer to Stripe
//   Purchase          Stripe brings a paid customer back (/order-confirmed)
//
// Privacy (src/components/TrustPages.jsx) describes this; change the two
// together.
// ---------------------------------------------------------------------------

export const META_PIXEL_ID = "1181218101009775";

let ready = false;

function load() {
  if (ready || typeof window === "undefined") return ready;
  /* eslint-disable */
  !(function (f, b, e, v, n, t, s) {
    if (f.fbq) return;
    n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = !0;
    n.version = "2.0";
    n.queue = [];
    t = b.createElement(e);
    t.async = !0;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
  /* eslint-enable */
  window.fbq("init", META_PIXEL_ID);
  document.addEventListener(
    "click",
    (e) => {
      const a = e.target?.closest?.("a[href]");
      if (!a) return;
      const h = a.getAttribute("href") || "";
      const method = /wa\.me|whatsapp/i.test(h) ? "whatsapp" : /^tel:/i.test(h) ? "phone" : /^mailto:/i.test(h) ? "email" : null;
      if (method) window.fbq("track", "Contact", { method });
    },
    true,
  );
  ready = true;
  return ready;
}

/** Send one standard event. Never throws: ads tracking must not break the shop. */
export function pixel(event, params) {
  try {
    if (!load()) return;
    if (params) window.fbq("track", event, params);
    else window.fbq("track", event);
  } catch {
    /* blocked by the browser or an extension: ignore */
  }
}

export const pixelPageView = () => pixel("PageView");
