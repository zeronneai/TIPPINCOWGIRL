// ---------------------------------------------------------------------------
// The order notification email, built from a paid Stripe Checkout session.
//
// SERVER SIDE ONLY. It lives next to pricing.js because it leans on the same
// catalog, but nothing in the browser imports it, so it never ships to the
// client. Like pricing.js it is pure: no DOM, no network, no side effects.
// Give it a session, get back { subject, html, text }.
//
// Two rules shape the HTML:
//   1. Email clients are primitive. Tables for layout, inline styles only,
//      no flexbox, no grid, no media queries we depend on. 600px max width.
//      This gets read on Gmail for Android more than anywhere else.
//   2. Everything that came from a customer is escaped before it lands in
//      the markup.
//
// Money comes from the Stripe session, which is what was actually charged.
// Names and links come from the catalog, so the email says
// "Leather & Buckle", never "leather".
// ---------------------------------------------------------------------------

// describeConfig is deliberately not used here: the email wants one labelled
// row per piece ("Band: Leather & Buckle"), not its one line summary.
import { buildPermalinkQuery, findBand, findBase, findBrand, findSize } from "./pricing.js";

/** Escape anything that might carry customer text into HTML. */
export const esc = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Always two decimals here. The site shows "$245" because whole dollars read
// better in a builder; an order confirmation should read like an invoice.
export const money = (cents) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format((Number(cents) || 0) / 100);

/**
 * Parse the hat records written by api/create-checkout-session.js:
 *
 *   hat_N = "base|band|brand|customText|size|quantity"
 *
 * Empty fields are legal anywhere. A record that does not split into exactly
 * six parts is reported rather than guessed at, so the email can say so.
 *
 * @returns {{cart: Array<object>, problems: string[]}}
 */
export function parseCartFromMetadata(metadata) {
  const md = metadata && typeof metadata === "object" ? metadata : {};
  const problems = [];
  const cart = [];

  const declared = Number(md.hat_count);
  const keys = Object.keys(md).filter((k) => /^hat_\d+$/.test(k));
  const found = keys.length;
  if (!found) {
    problems.push("No hat records were found in the session metadata.");
    return { cart, problems };
  }
  if (Number.isInteger(declared) && declared !== found)
    problems.push(`Metadata says ${declared} hats but carries ${found} records.`);

  for (let i = 1; i <= found; i += 1) {
    const raw = md[`hat_${i}`];
    if (typeof raw !== "string") {
      problems.push(`Hat ${i} is missing from the metadata.`);
      continue;
    }
    const parts = raw.split("|");
    if (parts.length !== 6) {
      problems.push(`Hat ${i} could not be read: ${raw}`);
      continue;
    }
    const [baseId, bandId, brandId, customText, size, quantity] = parts;
    const qty = Number(quantity);
    cart.push({
      baseId,
      bandId,
      brandId,
      customText: customText || null,
      // sizes are stored uppercase in the metadata, lowercase in the catalog
      size: String(size || "").toLowerCase(),
      quantity: Number.isInteger(qty) && qty > 0 ? qty : 1,
    });
    if (!Number.isInteger(qty) || qty < 1) problems.push(`Hat ${i} had an unreadable quantity: ${quantity}`);
  }
  return { cart, problems };
}

/** Human readable rows for one hat, skipping anything that does not apply. */
function hatRows(line) {
  const rows = [];
  const base = findBase(line.baseId);
  rows.push(["Base", base ? base.name : `Unknown (${line.baseId || "blank"})`]);

  const band = findBand(line.bandId);
  if (band && band.id !== "none") rows.push(["Band", band.name]);
  else if (line.bandId && line.bandId !== "none" && !band) rows.push(["Band", `Unknown (${line.bandId})`]);

  const brand = findBrand(line.brandId);
  if (brand && brand.id !== "none") {
    rows.push(["Brand", brand.custom ? "Your word" : brand.name]);
    if (brand.custom && line.customText) rows.push(["Custom text", String(line.customText).toUpperCase()]);
  } else if (line.brandId && line.brandId !== "none" && !brand) {
    rows.push(["Brand", `Unknown (${line.brandId})`]);
  }

  const size = findSize(line.size);
  rows.push(["Size", size ? size.name : `Unknown (${line.size || "blank"})`]);
  rows.push(["Quantity", String(line.quantity)]);
  return rows;
}

const addressLines = (details) => {
  const a = details?.address || {};
  const cityLine = [a.city, [a.state, a.postal_code].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return [details?.name, a.line1, a.line2, cityLine, a.country].filter((v) => v && String(v).trim());
};

const FONT = "font-family: Arial, Helvetica, sans-serif;";
const INK = "#2b1a10";
const MUTED = "#6b6b6b";
const RULE = "#dddddd";

/**
 * @param session  a Stripe checkout.session object (paid)
 * @param baseUrl  absolute site origin, for the builder permalinks
 * @returns {{subject: string, html: string, text: string}}
 */
export function buildOrderEmail({ session, baseUrl = "" }) {
  const s = session || {};
  const md = s.metadata || {};
  const { cart, problems } = parseCartFromMetadata(md);

  // Newer API versions moved the collected address; accept both shapes.
  const shipping = s.shipping_details || s.collected_information?.shipping_details || null;
  const customer = s.customer_details || {};
  const name = customer.name || shipping?.name || "";

  // Money as charged, from Stripe. Metadata is only the fallback, and a
  // missing or unparseable value must land on 0 rather than on NaN.
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

  const totalHats = cart.reduce((sum, line) => sum + line.quantity, 0) || Number(md.total_quantity) || 0;
  const hatWord = totalHats === 1 ? "hat" : "hats";
  const subject = `New order: ${totalHats} ${hatWord}, ${money(total)}${name ? ` - ${name}` : ""}`;

  const placed = new Date((s.created ? s.created * 1000 : Date.now()));
  const placedText = new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Denver",
  }).format(placed);

  const origin = String(baseUrl || "").replace(/\/+$/, "");
  const permalinkFor = (line) => `${origin}/?${buildPermalinkQuery(line)}#builder`;

  // ---- HTML --------------------------------------------------------------
  const hatBlocks = cart
    .map((line, i) => {
      const rows = hatRows(line)
        .map(
          ([label, value]) => `
                  <tr>
                    <td style="${FONT} font-size: 14px; color: ${MUTED}; padding: 3px 12px 3px 0; white-space: nowrap; vertical-align: top;">${esc(label)}</td>
                    <td style="${FONT} font-size: 14px; color: ${INK}; padding: 3px 0; font-weight: bold;">${esc(value)}</td>
                  </tr>`
        )
        .join("");
      const link = origin ? permalinkFor(line) : "";
      return `
          <tr>
            <td style="padding: 0 0 18px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border: 1px solid ${RULE}; border-radius: 6px;">
                <tr>
                  <td style="padding: 14px 16px;">
                    <p style="${FONT} font-size: 15px; font-weight: bold; color: ${INK}; margin: 0 0 10px 0;">Hat ${i + 1}</p>
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">${rows}
                    </table>
                    ${
                      link
                        ? `<p style="margin: 12px 0 0 0;"><a href="${esc(link)}" style="${FONT} font-size: 14px; color: #b04e28; font-weight: bold;">See this hat</a></p>`
                        : ""
                    }
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
    })
    .join("");

  const totalsRow = (label, value, bold = false) => `
                <tr>
                  <td style="${FONT} font-size: ${bold ? "16px" : "14px"}; color: ${bold ? INK : MUTED}; padding: 4px 0;${bold ? " font-weight: bold; border-top: 1px solid " + RULE + "; padding-top: 10px;" : ""}">${esc(label)}</td>
                  <td align="right" style="${FONT} font-size: ${bold ? "16px" : "14px"}; color: ${INK}; padding: 4px 0; font-weight: bold;${bold ? " border-top: 1px solid " + RULE + "; padding-top: 10px;" : ""}">${esc(value)}</td>
                </tr>`;

  const warning = problems.length
    ? `
          <tr>
            <td style="padding: 0 0 18px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border: 2px solid #b04e28; border-radius: 6px; background-color: #fdf3ef;">
                <tr>
                  <td style="padding: 14px 16px;">
                    <p style="${FONT} font-size: 14px; font-weight: bold; color: #b04e28; margin: 0 0 6px 0;">Some order details could not be read</p>
                    <p style="${FONT} font-size: 13px; color: ${INK}; margin: 0 0 8px 0; line-height: 1.5;">${problems.map((p) => esc(p)).join("<br>")}</p>
                    <p style="${FONT} font-size: 13px; color: ${INK}; margin: 0; line-height: 1.5;">Look this order up in the Stripe dashboard with the session id at the bottom of this email.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`
    : "";

  const contactRow = (label, value) =>
    value
      ? `
                  <tr>
                    <td style="${FONT} font-size: 14px; color: ${MUTED}; padding: 3px 12px 3px 0; white-space: nowrap;">${esc(label)}</td>
                    <td style="${FONT} font-size: 14px; color: ${INK}; padding: 3px 0;">${esc(value)}</td>
                  </tr>`
      : "";

  const address = addressLines(shipping);

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f4f4f4;">
    <tr>
      <td align="center" style="padding: 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width: 100%; max-width: 600px; background-color: #ffffff; border: 1px solid ${RULE}; border-radius: 6px;">
          <tr>
            <td style="padding: 20px 20px 8px 20px; border-bottom: 1px solid ${RULE};">
              <p style="${FONT} font-size: 20px; font-weight: bold; color: ${INK}; margin: 0 0 4px 0;">New order: ${esc(money(total))}</p>
              <p style="${FONT} font-size: 14px; color: ${MUTED}; margin: 0 0 12px 0;">${esc(totalHats)} ${esc(hatWord)} &middot; ${esc(placedText)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 18px 20px 0 20px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
${warning}${hatBlocks}
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding: 2px 20px 0 20px;">
              <p style="${FONT} font-size: 13px; font-weight: bold; color: ${MUTED}; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px 0;">Customer</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
${contactRow("Name", name)}${contactRow("Email", customer.email)}${contactRow("Phone", customer.phone)}
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding: 18px 20px 0 20px;">
              <p style="${FONT} font-size: 13px; font-weight: bold; color: ${MUTED}; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px 0;">Ship to</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border: 1px solid ${RULE}; border-radius: 6px; background-color: #fafafa;">
                <tr>
                  <td style="padding: 12px 14px; ${FONT} font-size: 14px; line-height: 1.6; color: ${INK};">${
                    address.length ? address.map((l) => esc(l)).join("<br>") : "<em>No shipping address on this session</em>"
                  }</td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding: 18px 20px 0 20px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
${totalsRow("Subtotal", money(subtotal))}${totalsRow("Shipping", shippingCost === 0 ? "Free shipping" : money(shippingCost))}${totalsRow("Total", money(total), true)}
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding: 20px; ">
              <p style="${FONT} font-size: 11px; color: #999999; margin: 0;">Stripe session ${esc(s.id || "unknown")}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  // ---- plain text --------------------------------------------------------
  const textHats = cart
    .map((line, i) => {
      const rows = hatRows(line)
        .map(([label, value]) => `  ${label}: ${value}`)
        .join("\n");
      const link = origin ? `\n  See this hat: ${permalinkFor(line)}` : "";
      return `Hat ${i + 1}\n${rows}${link}`;
    })
    .join("\n\n");

  const textParts = [
    `New order: ${money(total)}`,
    `${totalHats} ${hatWord} on ${placedText}`,
  ];
  if (problems.length)
    textParts.push(
      "",
      "SOME ORDER DETAILS COULD NOT BE READ",
      ...problems.map((p) => `  ${p}`),
      "  Look this order up in Stripe with the session id below."
    );
  textParts.push(
    "",
    textHats || "  (no hat details available)",
    "",
    "CUSTOMER",
    `  Name: ${name || "not given"}`,
    `  Email: ${customer.email || "not given"}`,
    `  Phone: ${customer.phone || "not given"}`,
    "",
    "SHIP TO",
    address.length ? address.map((l) => `  ${l}`).join("\n") : "  No shipping address on this session",
    "",
    "TOTALS",
    `  Subtotal: ${money(subtotal)}`,
    `  Shipping: ${shippingCost === 0 ? "Free shipping" : money(shippingCost)}`,
    `  Total: ${money(total)}`,
    "",
    `Stripe session ${s.id || "unknown"}`
  );
  const text = textParts.join("\n");

  return { subject, html, text, problems, totalHats };
}
