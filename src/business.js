// ---------------------------------------------------------------------------
// Business facts shared by the site and the server side emails.
//
// Pure, zero imports: the browser bundle imports this, and so do the Vercel
// functions through src/shop/customerEmail.js. Keep it that way, or the
// serverless bundle starts dragging in client code.
//
// One place per fact. If a value here changes, every page and email that
// shows it follows.
// ---------------------------------------------------------------------------

/** Production origin, used for canonical URLs. */
export const SITE_ORIGIN = "https://tippincowgirl.com";

/** Public contact address: footer, Privacy, Terms, Shipping & Returns. */
export const CONTACT_EMAIL = "tippincowgirlhatbar@gmail.com";

/**
 * Opening hours at The Shoppes at Solana, one line per entry.
 *
 * Shown in the Solana section of the site and in the footer of the customer
 * confirmation email, both read from here.
 *
 * WORD FOR WORD: the booking confirmation sent by the Google Apps Script
 * carries the same four lines, and that script cannot import this file.
 * If you change a line here, change it in the Apps Script too, exactly.
 */
export const STORE_HOURS = [
  "Thu and Fri 1 to 7 PM",
  "Sat 12 to 7 PM",
  "Sun 12 to 6 PM",
  "Mon to Wed by appointment for private events",
];
