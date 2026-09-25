// ---------------------------------------------------------------------------
// Trust pages: Shipping & Returns, Privacy, Terms, FAQ. Simple hash routes
// (#/shipping-returns, #/privacy, #/terms, #/faq) rendered instead of the
// landing. Stripe reviews these before activating the account, so nothing
// here may promise something the business does not actually do.
//
// Facts are read, never retyped:
//   - the contact address comes from CONTACT_EMAIL in src/business.js
//   - the shipping rate and the free shipping threshold come from pricing.js,
//     so when the owner confirms real numbers these pages follow on their own
//
// Two things are deliberately NOT stated anywhere below, and must not be
// added until the owner confirms them: a production or delivery time, and a
// carrier. The customer email makes the same no date promise
// (FULFILLMENT_NOTE in src/shop/customerEmail.js); keep the two aligned.
// ---------------------------------------------------------------------------

import { CONTACT_EMAIL } from "../business.js";
import { FREE_SHIPPING_MIN_QTY, SHIPPING_FLAT, formatCents } from "../shop/pricing.js";

// Shown at the top of Privacy and Terms. Change it whenever either changes.
const POLICY_EFFECTIVE_DATE = "September 25, 2026";

const P = { margin: "0 0 14px", fontSize: 15.5, lineHeight: 1.65, color: "#4a3a2c" };
const H3 = {
  margin: "26px 0 10px",
  fontWeight: 800,
  fontSize: 15,
  letterSpacing: ".08em",
  textTransform: "uppercase",
  color: "var(--ink)",
};
const LINK = { color: "var(--coral-deep)", fontWeight: 800 };
const EFFECTIVE = { margin: "0 0 18px", fontSize: 13.5, fontWeight: 700, color: "#6f5b48" };

const FLAT = formatCents(SHIPPING_FLAT);
const FREE_FROM = FREE_SHIPPING_MIN_QTY;

function Mail() {
  return (
    <a href={`mailto:${CONTACT_EMAIL}`} style={LINK}>
      {CONTACT_EMAIL}
    </a>
  );
}

function Instagram() {
  return (
    <a href="https://www.instagram.com/_tippincowgirl/" target="_blank" rel="noopener noreferrer" style={LINK}>
      @_tippincowgirl
    </a>
  );
}

export const TRUST_ROUTES = {
  "#/shipping-returns": {
    kicker: "The fine print, tipped politely",
    title: "Shipping & Returns",
    body: (
      <>
        <h3 style={H3}>Where we ship</h3>
        <p style={P}>
          We ship within the United States only. Checkout accepts US addresses, and we do not ship
          internationally for now.
        </p>

        <h3 style={H3}>What shipping costs</h3>
        <p style={P}>
          Shipping is a flat {FLAT} per order, and free on orders of {FREE_FROM} hats or more. You see the exact
          amount in your cart before you pay.
        </p>

        <h3 style={H3}>When your hat ships</h3>
        <p style={P}>
          Every hat is built by hand, to order, at the bar in El Paso, so we do not promise a fixed ship date.
          Right after you pay, you get an email confirming your order and everything you built.
        </p>
        <p style={P}>
          When your hat is on its way, Deborah shares the tracking number with you directly, using the contact
          details from your order.
        </p>

        <h3 style={H3}>Returns & exchanges</h3>
        <p style={P}>
          Every hat is made for you, often with a word branded right into it, so we cannot take a hat back
          because of a change of mind.
        </p>
        <p style={P}>
          If your hat arrives damaged, or it is not the build you ordered, write to us within 7 days of
          delivery with a photo. We will make it right with a repair, a remake or a refund, and we cover the
          shipping.
        </p>
        <p style={P}>
          If the size is not right, write to us within 7 days of delivery. Sizing is handled case by case, and
          we will work with you on an exchange or an adjustment. For a size exchange the hat needs to come
          back unworn, the way it arrived.
        </p>

        <h3 style={H3}>Questions</h3>
        <p style={P}>
          Email <Mail /> or DM <Instagram /> and we will sort it out.
        </p>
      </>
    ),
  },

  "#/privacy": {
    kicker: "Your data, kept under our hat",
    title: "Privacy",
    body: (
      <>
        <p style={EFFECTIVE}>Effective {POLICY_EFFECTIVE_DATE}</p>
        <p style={P}>
          We collect only what we need to build and ship your hat or plan your event. We do not sell your
          information, and we do not share it for advertising. Ever.
        </p>

        <h3 style={H3}>What we collect</h3>
        <p style={P}>
          When you order: your name, email, phone number, shipping address and the build you chose. When you
          book the bar: the details you type into the booking form, such as your name, email, phone, event type,
          date and notes.
        </p>
        <p style={P}>
          We ship within the United States only, so any shipping address we hold is a US address.
        </p>

        <h3 style={H3}>Payments</h3>
        <p style={P}>
          Payments are processed by Stripe. Your card details go straight to Stripe on its secure checkout page
          and never touch our servers; we never see or store your card number. Stripe handles that information
          under its own{" "}
          <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" style={LINK}>
            privacy policy
          </a>
          .
        </p>

        <h3 style={H3}>Who else handles your data</h3>
        <p style={P}>
          Only the services that make the site work: Stripe for payments, Google for booking requests (they are
          saved to a Google Sheet), our email provider to send your order confirmation, and our hosting
          provider to serve the site. Each one gets only what it needs for that job.
        </p>

        <h3 style={H3}>Cookies and tracking</h3>
        <p style={P}>
          No analytics, no ad trackers, no tracking cookies. Your browser keeps your cart on your own device so
          it survives closing the tab; clear your browser storage and it is gone. The map in the Solana section
          is Google Maps and only loads if you tap it. Our fonts come from Google Fonts and Fontshare, which see
          your IP address the way any site you load a file from does.
        </p>

        <h3 style={H3}>How long we keep it</h3>
        <p style={P}>
          We keep order and booking details for as long as we need them to make, ship and support your hat or
          your event, and to keep our business records.
        </p>

        <h3 style={H3}>Your choices</h3>
        <p style={P}>
          Want a copy of what we have, or want it deleted? Email <Mail />. No hoops. Some order records we may
          need to keep for tax and accounting, and we will tell you if that applies.
        </p>
      </>
    ),
  },

  "#/terms": {
    kicker: "Plain words, fair deal",
    title: "Terms",
    body: (
      <>
        <p style={EFFECTIVE}>Effective {POLICY_EFFECTIVE_DATE}</p>
        <p style={P}>
          Tippin' Cowgirl is a custom hat bar at The Shoppes at Solana, 750 Sunland Park Dr, El Paso, TX 79912.
          By ordering on this site or booking the bar, you agree to these terms.
        </p>

        <h3 style={H3}>Your order</h3>
        <p style={P}>
          Every hat is built by hand, to order. The builder shows a digital preview of your choices. Felt,
          bands and brands are handmade, so the finished hat can differ slightly from the preview in color,
          texture and placement. That is part of it being made by hand, not a defect.
        </p>
        <p style={P}>
          Your order is confirmed once your payment goes through and you receive our confirmation email.
        </p>

        <h3 style={H3}>Your custom word</h3>
        <p style={P}>
          We brand exactly what you type, in capital letters, up to 6 characters. Please check the spelling
          before you pay: a branded word cannot be undone. We may decline a word that is offensive or uses
          someone else's trademark, and if we do, we refund that order in full.
        </p>

        <h3 style={H3}>Prices and payment</h3>
        <p style={P}>
          Prices are in US dollars. The amount you pay is the total shown on the checkout page. Payments are
          processed by Stripe. If a price on the site changes, it does not affect an order you have already
          paid for.
        </p>

        <h3 style={H3}>Shipping and returns</h3>
        <p style={P}>
          We ship within the United States only. Shipping costs, when your hat ships and what happens if
          something is wrong are all on{" "}
          <a href="#/shipping-returns" style={LINK}>
            Shipping &amp; Returns
          </a>
          , which is part of these terms.
        </p>

        <h3 style={H3}>Booking the bar</h3>
        <p style={P}>
          Sending the booking form is a request, not a confirmed booking. A booking is confirmed only when we
          confirm it with you directly, along with the date and the details of your event.
        </p>

        <h3 style={H3}>Our content</h3>
        <p style={P}>
          The photos, text, logo and hat builder on this site belong to Tippin' Cowgirl. Please ask before
          reusing them.
        </p>

        <h3 style={H3}>Our responsibility</h3>
        <p style={P}>
          We stand behind our hats as described on these pages. To the extent the law allows, our
          responsibility for any order is limited to the amount you paid for it.
        </p>

        <h3 style={H3}>Changes and law</h3>
        <p style={P}>
          We may update these terms; the date at the top shows when they last changed, and the version in
          effect when you ordered applies to your order. These terms are governed by the laws of the State of
          Texas.
        </p>

        <h3 style={H3}>Contact</h3>
        <p style={P}>
          Email <Mail /> or DM <Instagram />.
        </p>
      </>
    ),
  },

  "#/faq": {
    kicker: "Asked at the bar, answered here",
    title: "FAQ",
    body: (
      <>
        <h3 style={H3}>How long does my hat take?</h3>
        <p style={P}>
          Every hat is built by hand, to order, so we do not promise a fixed ship date. After you order you get
          a confirmation email, and Deborah reaches out with the shipping details and tracking number once your
          hat is on its way.
        </p>

        <h3 style={H3}>How do I know my size?</h3>
        <p style={P}>
          Wrap a soft tape (or a string) around your head just above your eyebrows and ears, and match the
          centimeters to the size chart in the builder. Between two sizes? Go with the larger one.
        </p>

        <h3 style={H3}>How does shipping work?</h3>
        <p style={P}>
          We ship within the United States only. Shipping is a flat {FLAT} per order, and free on {FREE_FROM}{" "}
          hats or more. Once your hat ships, Deborah shares the tracking number with you directly.
        </p>

        <h3 style={H3}>Do you ship outside the US?</h3>
        <p style={P}>Not for now. Checkout only accepts US addresses.</p>

        <h3 style={H3}>Can I exchange it?</h3>
        <p style={P}>
          Every hat is made for you, so we cannot take one back because of a change of mind. If it arrives
          damaged, is not the build you ordered, or the size is off, write to us within 7 days of delivery. The
          details are on{" "}
          <a href="#/shipping-returns" style={LINK}>
            Shipping &amp; Returns
          </a>
          .
        </p>

        <h3 style={H3}>Where are you located?</h3>
        <p style={P}>
          At The Shoppes at Solana, 750 Sunland Park Dr, El Paso, TX 79912. The bar also rolls out to events
          and pop-ups around town.
        </p>

        <h3 style={H3}>How do I reach you?</h3>
        <p style={P}>
          Email <Mail /> or DM <Instagram />.
        </p>
      </>
    ),
  },
};

export default function TrustPage({ route }) {
  const page = TRUST_ROUTES[route];
  if (!page) return null;
  return (
    <main className="tc-px" style={{ padding: "64px 36px 90px", minHeight: "60vh" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div
          style={{
            fontSize: 11.5,
            fontWeight: 800,
            letterSpacing: ".24em",
            textTransform: "uppercase",
            color: "var(--teal)",
            marginBottom: 12,
          }}
        >
          {page.kicker}
        </div>
        <h1 className="tc-sticker" style={{ margin: "0 0 26px", fontSize: "clamp(34px,5.4vw,56px)" }}>
          {page.title}
        </h1>
        {page.body}
        <a href="#top" className="tc-btn tc-btn--ghost" style={{ marginTop: 18 }}>
          ← Back to the bar
        </a>
      </div>
    </main>
  );
}
