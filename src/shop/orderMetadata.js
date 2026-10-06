// ---------------------------------------------------------------------------
// The Stripe session metadata format: written by
// api/create-checkout-session.js, read back by the webhook for the emails.
// One module owns both directions so the two can never disagree.
//
// SERVER SIDE, pure, no imports beyond pricing.js.
//
// STRIPE LIMITS: 50 keys per session, 500 characters per value. A full cart
// (10 hats, every one with a stitching note and an engraving) uses
// 5 + 10 + 10 + 10 = 35 keys, and the longest record is about 90
// characters; a note is capped at STITCHING_NOTE_MAX_LEN (120), the longest
// possible engraving code is under 500 (see encodeEngraving in pricing.js),
// and every value is clipped to 500 again here regardless.
//
// FORMAT v3 (hat types), one record per hat, pipe separated, WRITTEN now:
//
//   hat_1      = "v3|wool|ivory|natural|stitching|raspberry|large|teal|turquoise|none||M|1"
//   hat_1_note = "a bit lighter please"          (only when there is a note)
//   hat_1_engr = "lt.d.DEB_ls.longhorn*ss.horseshoe"
//                (only when the hat is engraved; the code is
//                encodeEngraving in pricing.js. Missing means none, so every
//                order written before engraving reads unchanged.)
//
//   fields: v3 | hatType | base | feather | cord | cordColor | budSize |
//           budColor | matches | brand | brandText | size | quantity
//
// Suede sizes travel as "S-M" and "L-XL": a hyphen, never a pipe.
//
// FORMAT v2 (builder v2, before hat types), still READ, as wool:
//
//   hat_1 = "v2|ivory|natural|stitching|raspberry|large|teal|turquoise|none||M|1"
//   fields: v2 | base | feather | cord | cordColor | budSize | budColor |
//           matches | brand | brandText | size | quantity
//
// "none" means the step was left empty; an empty field means it does not
// apply (a color on a cord without colors). The brand fields ride along empty
// while BRANDS_ENABLED is off, so switching it back on needs no new format.
// Every field is a catalog id or the brand word, whose charset has no pipe;
// the note is free text, which is exactly why it gets its own key.
//
// FORMAT v1 (the first builder), still READ, as wool, so a payment made
// before a switch, and delivered or retried by Stripe after it, still
// produces a readable work order:
//
//   hat_1 = "chocolate|leather|star||M|1"
//   fields: base | band | brand | customText | size | quantity
//
// Plus the order wide keys: hat_count, total_quantity, subtotal, shipping,
// order_total, amounts in integer cents as strings.
// ---------------------------------------------------------------------------

import { encodeEngraving, normalizeConfig, parseEngraving } from "./pricing.js";

export const METADATA_VALUE_MAX = 500;
const clip = (v) => String(v ?? "").slice(0, METADATA_VALUE_MAX);

/** Build the metadata object for an order from buildOrder(). */
export function encodeOrderMetadata(order) {
  const md = {
    hat_count: String(order.lines.length),
    total_quantity: String(order.totalQuantity),
    subtotal: String(order.subtotal),
    shipping: String(order.shipping),
    order_total: String(order.total),
  };
  order.lines.forEach((line, i) => {
    const c = normalizeConfig(line.config);
    const n = i + 1;
    md[`hat_${n}`] = clip(
      [
        "v3",
        c.hatType,
        c.baseId ?? "",
        c.featherId,
        c.cordId,
        c.cordColor ?? "",
        c.budSize,
        c.budColor ?? "",
        c.matchesColor,
        c.brandId,
        (c.customText ?? "").toUpperCase(),
        (c.size ?? "").toUpperCase(),
        line.quantity,
      ].join("|")
    );
    if (c.stitchingNote) md[`hat_${n}_note`] = clip(c.stitchingNote);
    if (c.engraving.length) md[`hat_${n}_engr`] = clip(encodeEngraving(c.engraving));
  });
  return md;
}

const V3_FIELDS = 13;
const V2_FIELDS = 12;
const V1_FIELDS = 6;

/**
 * Read the hats back out of session metadata, v2 or v1.
 *
 * v3 and v2 lines come back as normalized configs plus quantity; a v2 line
 * (and a v1 line) is wool, since both predate hat types.
 * v1 lines come back as { legacy: true, baseId, bandId, brandId, customText,
 * size, quantity }: their band and brand no longer exist in the catalog, so
 * they are shown as recorded rather than priced or drawn.
 *
 * A record that cannot be read is reported rather than guessed at.
 *
 * @returns {{cart: Array<object>, problems: string[]}}
 */
export function parseCartFromMetadata(metadata) {
  const md = metadata && typeof metadata === "object" ? metadata : {};
  const problems = [];
  const cart = [];

  const declared = Number(md.hat_count);
  const found = Object.keys(md).filter((k) => /^hat_\d+$/.test(k)).length;
  if (!found) {
    problems.push("No hat records were found in the session metadata.");
    return { cart, problems };
  }
  if (Number.isInteger(declared) && declared !== found)
    problems.push(`Metadata says ${declared} hats but carries ${found} records.`);

  const quantityOf = (raw, i) => {
    const qty = Number(raw);
    if (Number.isInteger(qty) && qty > 0) return qty;
    problems.push(`Hat ${i} had an unreadable quantity: ${raw}`);
    return 1;
  };

  for (let i = 1; i <= found; i += 1) {
    const raw = md[`hat_${i}`];
    if (typeof raw !== "string") {
      problems.push(`Hat ${i} is missing from the metadata.`);
      continue;
    }
    const parts = raw.split("|");

    // v3 carries its type; v2 predates types and is wool.
    if (parts[0] === "v3" || parts[0] === "v2") {
      const v3 = parts[0] === "v3";
      if (parts.length !== (v3 ? V3_FIELDS : V2_FIELDS)) {
        problems.push(`Hat ${i} could not be read: ${raw}`);
        continue;
      }
      const fields = v3 ? parts.slice(1) : ["wool", ...parts.slice(1)];
      const [hatType, baseId, featherId, cordId, cordColor, budSize, budColor, matchesColor, brandId, customText, size, quantity] =
        fields;
      const engr = parseEngraving(md[`hat_${i}_engr`]);
      for (const p of engr.problems) problems.push(`Hat ${i}: ${p}`);
      const config = normalizeConfig({
        hatType,
        baseId,
        featherId,
        cordId,
        cordColor: cordColor || null,
        stitchingNote: md[`hat_${i}_note`] || null,
        budSize,
        budColor: budColor || null,
        matchesColor,
        brandId,
        customText: customText || null,
        // sizes are stored uppercase in the metadata, lowercase in the catalog
        size: String(size || "").toLowerCase(),
        engraving: engr.engraving,
      });
      if (config.hatType !== hatType) problems.push(`Hat ${i} has an unknown hat type: ${hatType}`);
      if (!config.baseId) problems.push(`Hat ${i} has an unknown base: ${baseId}`);
      if (config.engraving.length !== engr.engraving.length) problems.push(`Hat ${i} carries an engraving its type cannot take`);
      cart.push({ ...config, quantity: quantityOf(quantity, i) });
      continue;
    }

    if (parts.length === V1_FIELDS) {
      const [baseId, bandId, brandId, customText, size, quantity] = parts;
      cart.push({
        legacy: true,
        hatType: "wool",
        baseId,
        bandId,
        brandId,
        customText: customText || null,
        size: String(size || "").toLowerCase(),
        quantity: quantityOf(quantity, i),
      });
      continue;
    }

    problems.push(`Hat ${i} could not be read: ${raw}`);
  }
  return { cart, problems };
}
