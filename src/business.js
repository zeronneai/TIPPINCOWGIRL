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

/** Public contact address: footer, Privacy, Terms, Shipping & Returns. */
export const CONTACT_EMAIL = "tippincowgirlhatbar@gmail.com";
