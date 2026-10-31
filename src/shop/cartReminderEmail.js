// ---------------------------------------------------------------------------
// The "you left your hat behind" reminder, built from an EXPIRED Stripe
// Checkout session (checkout.session.expired).
//
// SERVER SIDE ONLY and pure, like customerEmail.js: give it a session, get
// back { subject, html, text } or null when there is nothing to send.
//
// WHO GETS IT (shouldSendCartReminder below, all must hold):
//   - the session is a hat order (event tickets are not), it expired unpaid,
//   - the customer typed an email on the Stripe page,
//   - and ticked "keep me updated" (consent.promotions === "opt_in"). The
//     checkout asks for it with consent_collection.promotions = "auto".
// The webhook also skips it when the same email started a newer checkout
// (they came back on their own, or already bought).
//
// The button opens the builder with that exact hat already set up (the same
// permalink the work order uses), so finishing is two taps: Add to cart,
// Checkout. With more than one hat, each gets its own link.
// ---------------------------------------------------------------------------

import { STORE_HOURS } from "../business.js";
import { customerHatRows } from "./customerEmail.js";
import { buildHatImageUrl, esc, parseCartFromMetadata } from "./orderEmail.js";
import { buildPermalinkQuery, findBase } from "./pricing.js";

const LOGO_URL = "https://tippincowgirl.com/email/logo.png";
const STORE_ADDRESS = "The Shoppes at Solana, 750 Sunland Park Dr, El Paso, TX 79912";
const INSTAGRAM_URL = "https://www.instagram.com/_tippincowgirl/";
const SITE = "https://tippincowgirl.com";

const CORAL = "#e8674a";
const CORAL_DEEP = "#b04e28";
const CREAM = "#faf1e2";
const INK = "#2b2118";
const MUTED = "#7a6a5c";
const LINE = "#e6d9c2";
const PANEL = "#fdf8ef";
const SERIF = "font-family: Georgia, 'Times New Roman', Times, serif;";
const SANS = "font-family: Arial, Helvetica, sans-serif;";

export const CART_REMINDER_SUBJECT = "Your hat is still waiting for you 🤠";

/** Should this expired session get a reminder? Returns { ok, reason }. */
export function shouldSendCartReminder(session) {
  const s = session || {};
  if (s.status && s.status !== "expired") return { ok: false, reason: `status ${s.status}` };
  if (s.payment_status === "paid") return { ok: false, reason: "already paid" };
  if (!s.customer_details?.email) return { ok: false, reason: "no email" };
  if (s.consent?.promotions !== "opt_in") return { ok: false, reason: "no email consent" };
  const { cart } = parseCartFromMetadata(s.metadata || {});
  if (!cart.length || cart.every((l) => l.legacy)) return { ok: false, reason: "no hats in the session" };
  return { ok: true };
}

const firstNameOf = (full) => String(full || "").trim().split(/\s+/)[0] || "";

/**
 * @param session  a Stripe checkout.session object (expired, unpaid)
 * @param baseUrl  site origin for the links (defaults to tippincowgirl.com)
 * @returns {{subject: string, html: string, text: string} | null}
 */
export function buildCartReminderEmail({ session, baseUrl = SITE }) {
  const s = session || {};
  const { cart } = parseCartFromMetadata(s.metadata || {});
  const hats = cart.filter((l) => !l.legacy);
  if (!hats.length) return null;

  const origin = String(baseUrl || SITE).replace(/\/+$/, "");
  const utm = "utm_source=email&utm_medium=email&utm_campaign=cart_reminder";
  const linkFor = (line) => `${origin}/?${buildPermalinkQuery(line)}&${utm}#builder`;

  const first = firstNameOf(s.customer_details?.name);
  const hello = first ? `Hi ${first},` : "Hi cowgirl,";
  const one = hats.length === 1;

  const button = (href, label) => `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>
                <td align="center" bgcolor="${INK}" style="border-radius: 999px;">
                  <a href="${esc(href)}" target="_blank" style="display: inline-block; padding: 15px 36px; ${SANS} font-size: 15px; font-weight: bold; letter-spacing: 2px; color: ${CREAM}; text-decoration: none;">${esc(label)}</a>
                </td>
              </tr></table>`;

  const hatBlocks = hats
    .map((line, i) => {
      const rows = customerHatRows(line)
        .map(
          ([label, value]) => `
                        <tr>
                          <td style="${SANS} font-size: 13px; color: ${MUTED}; padding: 2px 10px 2px 0; white-space: nowrap; vertical-align: top;">${esc(label)}</td>
                          <td style="${SANS} font-size: 14px; color: ${INK}; padding: 2px 0; font-weight: bold;">${esc(value)}</td>
                        </tr>`
        )
        .join("");
      const img = buildHatImageUrl(line, { width: 240 });
      const base = findBase(line.baseId, line.hatType);
      const imageCell = img
        ? `<td width="120" style="padding: 0 16px 0 0; vertical-align: top;"><img src="${esc(img)}" width="120" alt="${esc(base ? `${base.name} hat` : "Your hat")}" style="display: block; width: 120px; height: auto; border: 0;"></td>`
        : "";
      const label = one ? "Your hat" : `Hat ${i + 1} of ${hats.length}`;
      const link = one
        ? ""
        : `<p style="margin: 12px 0 0 0;"><a href="${esc(linkFor(line))}" style="${SANS} font-size: 14px; color: ${CORAL_DEEP}; font-weight: bold;">Finish this hat &rarr;</a></p>`;
      return `
              <tr><td style="padding: 0 0 14px 0;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: ${PANEL}; border: 1px solid ${LINE}; border-radius: 8px;">
                  <tr><td style="padding: 16px 18px;">
                    <p style="${SANS} font-size: 11px; font-weight: bold; color: ${CORAL_DEEP}; text-transform: uppercase; letter-spacing: 1.5px; margin: 0 0 12px 0;">${esc(label)}</p>
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${imageCell}
                      <td style="vertical-align: top;"><table role="presentation" cellpadding="0" cellspacing="0" border="0">${rows}
                      </table></td>
                    </tr></table>${link}
                  </td></tr>
                </table>
              </td></tr>`;
    })
    .join("");

  const intro = one
    ? "You were building something really cute and didn't get to finish. We saved your hat exactly how you left it, so it only takes a tap to pick up where you left off."
    : "You were building something really cute and didn't get to finish. We saved your hats exactly how you left them, so it only takes a tap to pick up where you left off.";

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(CART_REMINDER_SUBJECT)}</title></head>
<body style="margin: 0; padding: 0; background-color: ${CREAM};">
  <div style="display: none; max-height: 0; overflow: hidden;">Your custom hat is saved and ready whenever you are.</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: ${CREAM};">
    <tr><td align="center" style="padding: 16px 12px 28px 12px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width: 100%; max-width: 600px; background-color: #ffffff; border: 1px solid ${LINE}; border-radius: 10px;">
        <tr><td align="center" style="padding: 28px 24px 20px 24px; background-color: ${CREAM}; border-radius: 10px 10px 0 0;">
          <img src="${LOGO_URL}" width="200" alt="Tippin' Cowgirl" style="display: block; width: 200px; max-width: 100%; height: auto; border: 0; margin: 0 auto 12px auto;">
          <p style="${SANS} font-size: 10px; font-weight: bold; color: ${CORAL_DEEP}; text-transform: uppercase; letter-spacing: 2px; margin: 0;">Custom hats, built by you</p>
        </td></tr>
        <tr><td style="height: 5px; background-color: ${CORAL}; font-size: 0; line-height: 0;">&nbsp;</td></tr>

        <tr><td style="padding: 28px 24px 6px 24px;">
          <p style="${SERIF} font-size: 26px; line-height: 1.3; color: ${INK}; margin: 0 0 10px 0;">${esc(hello)}</p>
          <p style="${SANS} font-size: 15px; line-height: 1.6; color: ${INK}; margin: 0 0 14px 0;">${esc(intro)}</p>
        </td></tr>

        <tr><td style="padding: 6px 24px 0 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${hatBlocks}
          </table>
        </td></tr>

        <tr><td align="center" style="padding: 12px 24px 6px 24px;">${button(linkFor(hats[0]), one ? "FINISH MY HAT" : "FINISH MY HATS")}
        </td></tr>

        <tr><td style="padding: 20px 24px 26px 24px;">
          <p style="${SANS} font-size: 14px; line-height: 1.6; color: ${MUTED}; margin: 0;">Not sure about the size or a detail? Just reply to this email, it goes straight to Deborah. Every hat is made by hand at our hat bar in El Paso.</p>
        </td></tr>

        <tr><td align="center" style="padding: 22px 24px; background-color: ${CREAM}; border-radius: 0 0 10px 10px; border-top: 1px solid ${LINE};">
          <p style="${SERIF} font-size: 16px; color: ${CORAL_DEEP}; margin: 0 0 8px 0;">Tippin' Cowgirl</p>
          <p style="${SANS} font-size: 13px; line-height: 1.6; color: ${MUTED}; margin: 0 0 4px 0;">${esc(STORE_ADDRESS)}</p>
          ${STORE_HOURS.length ? `<p style="${SANS} font-size: 13px; line-height: 1.6; color: ${MUTED}; margin: 6px 0 4px 0;">${STORE_HOURS.map((l) => esc(l)).join("<br>")}</p>` : ""}
          <p style="${SANS} font-size: 13px; margin: 8px 0 0 0;"><a href="${INSTAGRAM_URL}" style="color: ${CORAL_DEEP}; font-weight: bold; text-decoration: none;">@_tippincowgirl on Instagram</a></p>
          <p style="${SANS} font-size: 11px; line-height: 1.5; color: #a89a8c; margin: 14px 0 0 0;">You are getting this one reminder because you started checking out on tippincowgirl.com and said yes to emails from us. Reply "unsubscribe" and we will not email you again.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const textHats = hats
    .map((line, i) => {
      const rows = customerHatRows(line).map(([l, v]) => `  ${l}: ${v}`).join("\n");
      const label = one ? "YOUR HAT" : `HAT ${i + 1} OF ${hats.length}`;
      return `${label}\n${rows}\n  Finish it here: ${linkFor(line)}`;
    })
    .join("\n\n");

  const text = [
    "TIPPIN' COWGIRL",
    "",
    hello,
    "",
    intro,
    "",
    textHats,
    "",
    "Not sure about the size or a detail? Just reply to this email, it goes straight to Deborah.",
    "",
    "---",
    "Tippin' Cowgirl",
    STORE_ADDRESS,
    ...STORE_HOURS,
    INSTAGRAM_URL,
    "",
    'You are getting this one reminder because you started checking out on tippincowgirl.com and said yes to emails from us. Reply "unsubscribe" and we will not email you again.',
  ].join("\n");

  return { subject: CART_REMINDER_SUBJECT, html, text };
}
