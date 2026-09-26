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

// The labelled rows come from hatParts() in pricing.js, the same list that
// prices the order, so the email can never describe a different hat from
// the one that was charged. describeConfig's one line summary is used for
// the hat image's alt text, which is all a reader sees when their client
// blocks remote images.
import { ACCESSORY_PUBLIC_IDS, BASES, CLOUDINARY_CLOUD, accessoryLayers, findIn } from "./catalog.js";
import { parseCartFromMetadata } from "./orderMetadata.js";
import { BRAND_OPTIONS, buildPermalinkQuery, describeConfig, findBase, findSize, hatParts } from "./pricing.js";

export { parseCartFromMetadata };

// ---------------------------------------------------------------------------
// One flattened hat image, composed by Cloudinary.
//
// The site stacks the layers with CSS. Email clients cannot, so Cloudinary
// flattens them first with chained overlays in the URL itself, in the SAME
// order catalog.js fixes for the stage:
//
//   base     root image
//   feather  overlay
//   cord     overlay (over the feather)
//   bud      overlay
//   matches  overlay
//
// Every layer is 1600x1600, so each overlay lands 1:1 on the full size base,
// and the resize to email width is the LAST step, after every fl_layer_apply,
// so scaling can never knock a layer out of register.
//
// A picture MISSING a piece the customer paid for is worse than no picture:
// it is exactly the mismatch that turns into a return. So an overlay is only
// possible for layers listed in ACCESSORY_PUBLIC_IDS (catalog.js), and a hat
// using any layer that is not listed gets null, meaning no image at all.
// Today that list is empty (the accessory PNGs are in the repo, not yet on
// Cloudinary), so only base only hats get a picture. The rows below the
// picture always carry the full build.
// ---------------------------------------------------------------------------

const CLOUDINARY_BASE = `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/image/upload`;

// Delivered at twice the displayed size so the picture stays sharp on the
// phone screens this actually gets read on.
const HAT_IMAGE_WIDTH = 240;
const HAT_IMAGE_DISPLAY = 120;

// Inside an overlay reference a public id cannot carry slashes: folder
// separators are written as colons.
const overlayRef = (publicId) => String(publicId).replace(/\//g, ":");

/**
 * Build a single URL for the composed hat, or null when it cannot be built
 * faithfully. Never throws: the email must go out even if the picture cannot.
 *
 * @param config  a hat config (see pricing.js)
 * @param width   delivered pixel width, default 240
 * @returns {string|null}
 */
export function buildHatImageUrl(config, { width = 240 } = {}) {
  try {
    const c = config || {};
    if (c.legacy) return null;
    const base = findIn(BASES, c.baseId);
    if (!base?.publicId || !base?.layerFile) return null;

    const w = Number.isInteger(width) && width > 0 ? width : 240;
    const chain = [];
    for (const l of accessoryLayers(c)) {
      const id = ACCESSORY_PUBLIC_IDS[l.key];
      if (!id) return null; // a piece we cannot draw: no picture, never a wrong one
      chain.push(`l_${overlayRef(id)}`, "fl_layer_apply");
    }
    chain.push(`w_${w},c_fit,f_auto,q_auto`);
    return `${CLOUDINARY_BASE}/${chain.join("/")}/${base.layerFile}`;
  } catch {
    return null;
  }
}

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

// Names for the first builder's bands, which no longer exist in the catalog.
// Only used to read out a v1 order that was paid before the switch.
const LEGACY_BAND_NAMES = {
  none: null,
  "lace-pearls": "Lace & Pearls",
  ribbons: "Braided Ribbons",
  leather: "Leather & Buckle",
  feathers: "Feather",
  turquoise: "Turquoise Stone",
};

/**
 * "Name, Color (what it physically is)". The owner reads the catalog name
 * the customer chose AND the plain description, so she knows which piece to
 * pull without memorizing the names: "Barbed & Beautiful (leather barbed wire)".
 */
const partValue = (p) => {
  const name = p.detail ? `${p.name}, ${p.detail}` : p.name;
  return p.plain ? `${name} (${p.plain})` : name;
};

/**
 * Human readable rows for one hat, skipping every step left at "none", so a
 * bare hat never shows an empty row or the word "none".
 */
export function hatRows(line) {
  const rows = [];
  if (line.legacy) {
    const base = findBase(line.baseId);
    rows.push(["Base", base ? base.name : `Unknown (${line.baseId || "blank"})`]);
    const band = LEGACY_BAND_NAMES[line.bandId];
    if (band) rows.push(["Band (first builder)", band]);
    else if (line.bandId && line.bandId !== "none") rows.push(["Band (first builder)", line.bandId]);
    const brand = BRAND_OPTIONS.find((b) => b.id === line.brandId);
    if (brand && brand.id !== "none") rows.push(["Brand (first builder)", brand.custom ? "Your word" : brand.name]);
    if (brand?.custom && line.customText) rows.push(["Custom text", String(line.customText).toUpperCase()]);
  } else {
    const parts = hatParts(line);
    if (!parts.some((p) => p.step === "base")) rows.push(["Base", `Unknown (${line.baseId || "blank"})`]);
    for (const p of parts) {
      rows.push([p.label, partValue(p)]);
      if (p.step === "cord" && line.stitchingNote) rows.push(["Color note", line.stitchingNote]);
    }
  }
  const size = findSize(line.size);
  rows.push(["Size", size ? size.name : `Unknown (${line.size || "blank"})`]);
  rows.push(["Quantity", String(line.quantity)]);
  return rows;
}

// Exported for customerEmail.js, which formats the same Stripe address block
// the same way. Nothing about the owner's email changes by sharing it.
export const addressLines = (details) => {
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
      // A first builder hat cannot be rebuilt in this builder (its band and
      // brand are gone), so it gets no link rather than a wrong one.
      const link = origin && !line.legacy ? permalinkFor(line) : "";
      const imageUrl = buildHatImageUrl(line, { width: HAT_IMAGE_WIDTH });
      // Plenty of clients block remote images by default, so the alt text
      // has to carry the build on its own. A hat with no composable image
      // simply renders as it did before, never as a broken picture.
      const imageCell = imageUrl
        ? `
                    <td width="${HAT_IMAGE_DISPLAY}" style="padding: 0 14px 0 0; vertical-align: top;">
                      <img src="${esc(imageUrl)}" width="${HAT_IMAGE_DISPLAY}" alt="${esc(describeConfig(line))}" style="display: block; width: ${HAT_IMAGE_DISPLAY}px; max-width: ${HAT_IMAGE_DISPLAY}px; height: auto; border: 0; outline: none; text-decoration: none;">
                    </td>`
        : "";
      return `
          <tr>
            <td style="padding: 0 0 18px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border: 1px solid ${RULE}; border-radius: 6px;">
                <tr>
                  <td style="padding: 14px 16px;">
                    <p style="${FONT} font-size: 15px; font-weight: bold; color: ${INK}; margin: 0 0 10px 0;">Hat ${i + 1}</p>
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>${imageCell}
                        <td style="vertical-align: top;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0">${rows}
                          </table>
                        </td>
                      </tr>
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
      const link = origin && !line.legacy ? `\n  See this hat: ${permalinkFor(line)}` : "";
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
