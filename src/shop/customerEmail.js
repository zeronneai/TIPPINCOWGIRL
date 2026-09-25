// ---------------------------------------------------------------------------
// The customer's order confirmation, built from a paid Stripe Checkout
// session.
//
// SERVER SIDE ONLY and pure, exactly like orderEmail.js: give it a session,
// get back { subject, html, text }. Nothing in the browser imports it.
//
// WHY THIS IS A SEPARATE FILE FROM orderEmail.js
//
// The two emails have opposite jobs and are meant to look nothing alike.
//
//   orderEmail.js    goes to Deborah. It is a work order: plain, dense,
//                    system fonts, every field spelled out including the
//                    builder permalink, readable on a phone with both hands
//                    busy. Do not decorate it.
//   customerEmail.js goes to the person who just spent real money on a
//                    handmade hat. It is the brand speaking: logo, the site
//                    palette, Georgia headings, room to breathe.
//
// Sharing one template would force one of them to be wrong, so they share
// only the pieces that must never diverge: the composed hat image, the
// metadata parser, the money formatter and the escaper.
//
// THE PERMALINK IS DELIBERATELY ABSENT. In the owner's email it is the link
// she builds the hat from. Here it would read as "edit your order", and the
// order is already paid.
//
// Three constraints shape the markup:
//   1. Email clients are primitive. Tables for layout, inline styles only,
//      no flexbox, no grid, no web fonts. 600px max width, and it has to
//      stay readable at 390px, which is the narrow end of the phones this
//      gets opened on.
//   2. It has to still read as a confirmation with remote images blocked,
//      which is the default in plenty of clients. No layout depends on an
//      image loading, the logo carries alt text, and the wordmark under it
//      is real text.
//   3. Everything that came from the customer is escaped before it lands in
//      the markup.
// ---------------------------------------------------------------------------

import { STORE_HOURS } from "../business.js";
import { addressLines, buildHatImageUrl, esc, money, parseCartFromMetadata } from "./orderEmail.js";
import { findBand, findBase, findBrand, findSize } from "./pricing.js";

// ---------------------------------------------------------------------------
// TODO(fulfillment): REPLACE THIS ONCE DEBORAH CONFIRMS A REAL TURNAROUND.
//
// Nobody has measured how long a hat actually takes to build and ship, so
// this text promises no date on purpose. A confirmation that says "ships in
// 5 to 7 business days" and then does not is worse than one that says
// nothing: it converts a happy customer into a refund request on day eight.
//
// When the real number is known, write it here in plain words, for example
// "Your hat will be ready to ship within about two weeks." The HTML and the
// plain text version both read this constant.
//
// The site makes the same no date promise and has to change in the same
// commit, or the email and the pages start contradicting each other:
// "How long does my hat take?" in the FAQ and "When your hat ships" in
// Shipping & Returns, both in src/components/TrustPages.jsx.
// ---------------------------------------------------------------------------
const FULFILLMENT_NOTE =
  "Every hat is made to order by hand, so it is not an off the shelf thing. Deborah will email you with the shipping details as soon as your order is on its way.";

// The logo, served at 400px and displayed at 200 so it stays sharp on a
// retina phone. No f_auto on purpose: that would hand WebP to clients that
// cannot decode it, and a broken logo is the first thing a reader sees.
const LOGO_URL =
  "https://res.cloudinary.com/dsprn0ew4/image/upload/w_400,q_auto/v1781730462/ChatGPT_Image_Jun_17_2026_03_05_51_PM_1_wyaelg.png";
const LOGO_DISPLAY = 200;

// The shop. Kept in sync by hand with SOLANA_ADDRESS in src/App.jsx.
const STORE_ADDRESS = "The Shoppes at Solana, 750 Sunland Park Dr, El Paso, TX 79912";
const INSTAGRAM_URL = "https://www.instagram.com/_tippincowgirl/";

// Opening hours come from STORE_HOURS in src/business.js, the same list the
// Solana section of the site shows, so the two cannot drift apart.

// Same palette as the site, hard coded because an email cannot read CSS
// custom properties.
const CORAL = "#e8674a";
const CORAL_DEEP = "#b04e28";
const CREAM = "#faf1e2";
const INK = "#2b2118";
const MUTED = "#7a6a5c";
const LINE = "#e6d9c2";
const PANEL = "#fdf8ef";

// Georgia for headings. Alfa Slab One is the brand face on the site but it
// is a web font, and web fonts do not load in Gmail, Outlook or Apple Mail.
// Georgia is installed nearly everywhere and is the closest warm serif that
// will actually render, with a full serif stack behind it.
const SERIF = "font-family: Georgia, 'Times New Roman', Times, serif;";
const SANS = "font-family: Arial, Helvetica, sans-serif;";

const HAT_IMAGE_WIDTH = 240;
const HAT_IMAGE_DISPLAY = 120;

/** First name only, for the greeting. Falls back to a warm generic. */
function firstNameOf(full) {
  const first = String(full || "").trim().split(/\s+/)[0] || "";
  return first;
}

/**
 * The rows describing one hat, for the customer.
 *
 * Differs from the owner's version in two ways that matter here: an option
 * the customer did not choose produces no row at all rather than the word
 * "none", and an id the catalog cannot resolve is skipped rather than
 * printed as "Unknown (xyz)". The customer cannot act on a broken id; the
 * owner's email is where those are reported.
 */
function hatRows(line) {
  const rows = [];

  const base = findBase(line.baseId);
  if (base) rows.push(["Hat", base.name]);

  const band = findBand(line.bandId);
  if (band && band.id !== "none") rows.push(["Band", band.name]);

  const brand = findBrand(line.brandId);
  if (brand && brand.id !== "none") {
    rows.push(["Brand", brand.custom ? "Your word" : brand.name]);
    if (brand.custom && line.customText) rows.push(["Your word", String(line.customText).toUpperCase()]);
  }

  const size = findSize(line.size);
  if (size) rows.push(["Size", size.name]);

  if (line.quantity > 1) rows.push(["Quantity", String(line.quantity)]);
  return rows;
}

/**
 * @param session  a Stripe checkout.session object (paid)
 * @returns {{subject: string, html: string, text: string}}
 */
export function buildCustomerEmail({ session }) {
  const s = session || {};
  const md = s.metadata || {};
  const { cart } = parseCartFromMetadata(md);

  // Newer API versions moved the collected address; accept both shapes.
  const shipping = s.shipping_details || s.collected_information?.shipping_details || null;
  const customer = s.customer_details || {};
  const first = firstNameOf(customer.name || shipping?.name || "");
  const greeting = first ? `Thank you, ${first}.` : "Thank you.";

  // Money as charged, from Stripe. Metadata is only a fallback, and an
  // unreadable value has to land on 0 rather than on NaN.
  const amount = (...candidates) => {
    for (const c of candidates) {
      const n = Number(c);
      if (Number.isFinite(n)) return n;
    }
    return 0;
  };
  const subtotal = amount(s.amount_subtotal, md.subtotal);
  const shippingCost = amount(s.total_details?.amount_shipping, md.shipping);
  const total = amount(s.amount_total, md.order_total);
  const shippingLabel = shippingCost === 0 ? "Free shipping" : money(shippingCost);

  const totalHats = cart.reduce((sum, line) => sum + line.quantity, 0) || Number(md.total_quantity) || 0;
  const hatWord = totalHats === 1 ? "hat" : "hats";

  // Fixed wording, one hat or five. This is the line she reads in her inbox
  // list, and it has to say the same reassuring thing every time.
  const subject = "Your hat is on the way - Tippin' Cowgirl";

  const address = addressLines(shipping);

  // ---- HTML --------------------------------------------------------------
  const heading = (textValue, size = 22) =>
    `<p style="${SERIF} font-size: ${size}px; line-height: 1.3; color: ${INK}; margin: 0 0 10px 0; font-weight: normal;">${textValue}</p>`;

  const body = (textValue, extra = "") =>
    `<p style="${SANS} font-size: 15px; line-height: 1.6; color: ${INK}; margin: 0 0 14px 0;${extra}">${textValue}</p>`;

  const sectionLabel = (textValue) =>
    `<p style="${SANS} font-size: 11px; font-weight: bold; color: ${CORAL_DEEP}; text-transform: uppercase; letter-spacing: 1.5px; margin: 0 0 10px 0;">${esc(textValue)}</p>`;

  const hatBlocks = cart
    .map((line, i) => {
      const rows = hatRows(line)
        .map(
          ([label, value]) => `
                        <tr>
                          <td style="${SANS} font-size: 13px; color: ${MUTED}; padding: 2px 10px 2px 0; white-space: nowrap; vertical-align: top;">${esc(label)}</td>
                          <td style="${SANS} font-size: 14px; color: ${INK}; padding: 2px 0; font-weight: bold;">${esc(value)}</td>
                        </tr>`
        )
        .join("");

      const imageUrl = buildHatImageUrl(line, { width: HAT_IMAGE_WIDTH });
      const base = findBase(line.baseId);
      // With images blocked this alt text is the whole picture, so it says
      // what the hat is rather than "hat image".
      const alt = base ? `${base.name} hat` : "Your hat";
      const imageCell = imageUrl
        ? `
                        <td width="${HAT_IMAGE_DISPLAY}" style="padding: 0 16px 0 0; vertical-align: top;">
                          <img src="${esc(imageUrl)}" width="${HAT_IMAGE_DISPLAY}" alt="${esc(alt)}" style="display: block; width: ${HAT_IMAGE_DISPLAY}px; max-width: ${HAT_IMAGE_DISPLAY}px; height: auto; border: 0; outline: none; text-decoration: none;">
                        </td>`
        : "";

      const label = cart.length > 1 ? `Hat ${i + 1} of ${cart.length}` : "Your hat";

      return `
              <tr>
                <td style="padding: 0 0 14px 0;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: ${PANEL}; border: 1px solid ${LINE}; border-radius: 8px;">
                    <tr>
                      <td style="padding: 16px 18px;">
                        <p style="${SANS} font-size: 11px; font-weight: bold; color: ${CORAL_DEEP}; text-transform: uppercase; letter-spacing: 1.5px; margin: 0 0 12px 0;">${esc(label)}</p>
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                          <tr>${imageCell}
                            <td style="vertical-align: top;">
                              <table role="presentation" cellpadding="0" cellspacing="0" border="0">${rows}
                              </table>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>`;
    })
    .join("");

  const totalsRow = (label, value, strong = false) => `
                <tr>
                  <td style="${SANS} font-size: ${strong ? "16px" : "14px"}; color: ${strong ? INK : MUTED}; padding: ${strong ? "12px 0 0 0" : "5px 0"};${strong ? ` font-weight: bold; border-top: 2px solid ${LINE};` : ""}">${esc(label)}</td>
                  <td align="right" style="${SANS} font-size: ${strong ? "16px" : "14px"}; color: ${strong ? CORAL_DEEP : INK}; padding: ${strong ? "12px 0 0 0" : "5px 0"}; font-weight: bold;${strong ? ` border-top: 2px solid ${LINE};` : ""}">${esc(value)}</td>
                </tr>`;

  const nextStep = (textValue) => `
                <tr>
                  <td width="16" style="${SANS} font-size: 15px; color: ${CORAL}; padding: 0 0 8px 0; vertical-align: top; line-height: 1.6;">&bull;</td>
                  <td style="${SANS} font-size: 15px; line-height: 1.6; color: ${INK}; padding: 0 0 8px 0;">${textValue}</td>
                </tr>`;

  const hoursLine = STORE_HOURS.length
    ? `<p style="${SANS} font-size: 13px; line-height: 1.6; color: ${MUTED}; margin: 8px 0 4px 0;">${STORE_HOURS.map((l) => esc(l)).join("<br>")}</p>`
    : "";

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin: 0; padding: 0; background-color: ${CREAM};">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: ${CREAM};">
    <tr>
      <td align="center" style="padding: 16px 12px 28px 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width: 100%; max-width: 600px; background-color: #ffffff; border: 1px solid ${LINE}; border-radius: 10px;">

          <tr>
            <td align="center" style="padding: 28px 24px 20px 24px; background-color: ${CREAM}; border-radius: 10px 10px 0 0;">
              <img src="${esc(LOGO_URL)}" width="${LOGO_DISPLAY}" alt="Tippin' Cowgirl" style="display: block; width: ${LOGO_DISPLAY}px; max-width: 100%; height: auto; border: 0; outline: none; text-decoration: none; margin: 0 auto 12px auto;">
              <p style="${SANS} font-size: 10px; font-weight: bold; color: ${CORAL_DEEP}; text-transform: uppercase; letter-spacing: 2px; margin: 0;">Custom Mobile Hat Bar &bull; El Paso, TX</p>
            </td>
          </tr>
          <tr><td style="height: 5px; background-color: ${CORAL}; font-size: 0; line-height: 0;">&nbsp;</td></tr>

          <tr>
            <td style="padding: 28px 24px 4px 24px;">
              ${heading(esc(greeting), 26)}
              ${body(`Your order is in. Every hat is built by hand at the hat bar, one at a time, and yours is now on the list.`)}
            </td>
          </tr>

          <tr>
            <td style="padding: 10px 24px 0 24px;">
              ${sectionLabel(totalHats === 1 ? "What you built" : `What you built (${totalHats} ${hatWord})`)}
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
${hatBlocks}
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding: 8px 24px 0 24px;">
              ${sectionLabel("Order total")}
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
${totalsRow("Subtotal", money(subtotal))}${totalsRow("Shipping", shippingLabel)}${totalsRow("Total paid", money(total), true)}
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding: 26px 24px 0 24px;">
              ${sectionLabel("Shipping to")}
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: ${PANEL}; border: 1px solid ${LINE}; border-radius: 8px;">
                <tr>
                  <td style="padding: 14px 16px; ${SANS} font-size: 14px; line-height: 1.7; color: ${INK};">${
                    address.length
                      ? address.map((l) => esc(l)).join("<br>")
                      : "We do not have a shipping address on this order. Reply to this email and we will sort it out."
                  }</td>
                </tr>
              </table>
              <p style="${SANS} font-size: 13px; line-height: 1.6; color: ${MUTED}; margin: 8px 0 0 0;">Please give that a quick look. If anything is wrong, reply to this email and we will fix it before your hat ships.</p>
            </td>
          </tr>

          <tr>
            <td style="padding: 26px 24px 0 24px;">
              ${sectionLabel("What happens next")}
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
${nextStep(esc(FULFILLMENT_NOTE))}${nextStep("If she needs to check anything about your build, she will email you first.")}${nextStep("You will hear from her again the day your order ships.")}
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding: 26px 24px 4px 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top: 1px solid ${LINE};">
                <tr><td style="height: 18px; font-size: 0; line-height: 0;">&nbsp;</td></tr>
              </table>
              ${body(`Any question at all, just reply to this email. It goes straight to Deborah.`, " margin-bottom: 0;")}
            </td>
          </tr>

          <tr>
            <td align="center" style="padding: 24px; background-color: ${CREAM}; border-radius: 0 0 10px 10px; border-top: 1px solid ${LINE};">
              <p style="${SERIF} font-size: 16px; color: ${CORAL_DEEP}; margin: 0 0 8px 0;">Tippin' Cowgirl</p>
              <p style="${SANS} font-size: 13px; line-height: 1.6; color: ${MUTED}; margin: 0 0 4px 0;">${esc(STORE_ADDRESS)}</p>
              ${hoursLine}
              <p style="${SANS} font-size: 13px; line-height: 1.6; margin: 8px 0 0 0;"><a href="${esc(INSTAGRAM_URL)}" style="color: ${CORAL_DEEP}; font-weight: bold; text-decoration: none;">@_tippincowgirl on Instagram</a></p>
              <p style="${SANS} font-size: 10px; color: #a89a8c; margin: 14px 0 0 0;">Order reference ${esc(s.id || "unknown")}</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  // ---- plain text --------------------------------------------------------
  // Same content in the same order, for clients that refuse HTML and for
  // spam filters, which treat a missing text part as a smell.
  const textHats = cart
    .map((line, i) => {
      const label = cart.length > 1 ? `Hat ${i + 1} of ${cart.length}` : "Your hat";
      const rows = hatRows(line)
        .map(([rowLabel, value]) => `  ${rowLabel}: ${value}`)
        .join("\n");
      return `${label}\n${rows}`;
    })
    .join("\n\n");

  const textParts = [
    "TIPPIN' COWGIRL",
    "Custom Mobile Hat Bar, El Paso, TX",
    "",
    greeting,
    "",
    "Your order is in. Every hat is built by hand at the hat bar, one at a",
    "time, and yours is now on the list.",
    "",
    totalHats === 1 ? "WHAT YOU BUILT" : `WHAT YOU BUILT (${totalHats} ${hatWord})`,
    "",
    textHats || "  (your build details are in this order, we have them on file)",
    "",
    "ORDER TOTAL",
    `  Subtotal: ${money(subtotal)}`,
    `  Shipping: ${shippingLabel}`,
    `  Total paid: ${money(total)}`,
    "",
    "SHIPPING TO",
    address.length
      ? address.map((l) => `  ${l}`).join("\n")
      : "  We do not have a shipping address on this order. Reply to this email and we will sort it out.",
    "",
    "  Please give that a quick look. If anything is wrong, reply to this",
    "  email and we will fix it before your hat ships.",
    "",
    "WHAT HAPPENS NEXT",
    `  - ${FULFILLMENT_NOTE}`,
    "  - If she needs to check anything about your build, she will email you first.",
    "  - You will hear from her again the day your order ships.",
    "",
    "Any question at all, just reply to this email. It goes straight to Deborah.",
    "",
    "---",
    "Tippin' Cowgirl",
    STORE_ADDRESS,
  ];
  textParts.push(...STORE_HOURS);
  textParts.push(INSTAGRAM_URL, "", `Order reference ${s.id || "unknown"}`);

  return { subject, html, text: textParts.join("\n"), totalHats };
}
