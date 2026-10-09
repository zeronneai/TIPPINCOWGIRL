// ---------------------------------------------------------------------------
// One paid Stripe checkout session as a row of the `orders` table
// (supabase/schema.sql). Written by the webhook, read by the staff portal.
//
// SERVER SAFE and pure, like orderEmail.js: it reads the same metadata
// format through parseCartFromMetadata, so the order in the database and
// the work order email can never describe two different hats.
//
// MONEY. The order totals are what Stripe charged, from the session itself
// (amount_subtotal, total_details.amount_shipping, amount_total), with the
// server written metadata only as a fallback. Each hat's unit price is
// recomputed here from the catalog (buildOrder), never read from anything
// the browser sent: the metadata holds catalog ids, not prices.
//
// Each hat keeps its normalized `config`, which is exactly what HatStack
// needs to redraw the preview, plus the layer ids it resolves to today, so
// the record still says what was drawn if a file is renamed later.
// ---------------------------------------------------------------------------

import { accessoryLayers, baseArtFor } from "./catalog.js";
import { engravingRows } from "./engravingText.js";
import { parseCartFromMetadata } from "./orderMetadata.js";
import { brandCount, buildOrder, findBase, findSize, hatParts, hatTypeOf, normalizeConfig } from "./pricing.js";

export const ORDER_STATUSES = ["new", "in_production", "ready", "shipped", "delivered", "cancelled"];

const firstNumber = (...candidates) => {
  for (const c of candidates) {
    const n = Number(c);
    if (c !== null && c !== undefined && c !== "" && Number.isFinite(n)) return Math.round(n);
  }
  return 0;
};

/** Stripe's address block, or null. */
function addressOf(session) {
  const shipping = session.shipping_details || session.collected_information?.shipping_details || null;
  if (!shipping) return null;
  const a = shipping.address || {};
  return {
    name: shipping.name || null,
    line1: a.line1 || null,
    line2: a.line2 || null,
    city: a.city || null,
    state: a.state || null,
    postal_code: a.postal_code || null,
    country: a.country || null,
    phone: session.customer_details?.phone || null,
  };
}

/** One hat of the cart as stored in orders.hats. */
export function hatSnapshot(line, index) {
  if (line.legacy) {
    // a v1 order from the first builder: shown as recorded, not drawn
    return {
      index,
      legacy: true,
      hat_type: "wool",
      hat_label: "Wool Hat",
      base_id: line.baseId ?? null,
      color: findBase(line.baseId)?.name ?? line.baseId ?? null,
      size: line.size ?? null,
      size_label: findSize(line.size)?.name ?? line.size ?? null,
      quantity: line.quantity,
      legacy_fields: { bandId: line.bandId ?? null, brandId: line.brandId ?? null, customText: line.customText ?? null },
      accessories: [],
      engraving: [],
      engraving_rows: [],
      brand_count: 0,
      config: null,
      layers: null,
      unit_price: null,
      line_total: null,
    };
  }
  const config = normalizeConfig(line);
  const type = hatTypeOf(config);
  const parts = hatParts(config);
  const priced = buildOrder([{ ...config, quantity: line.quantity }]).lines[0];
  return {
    index,
    legacy: false,
    hat_type: type.id,
    hat_label: type.label,
    base_id: config.baseId,
    color: findBase(config.baseId, config.hatType)?.name ?? null,
    size: config.size,
    size_label: findSize(config.size, config.hatType)?.name ?? null,
    quantity: line.quantity,
    accessories: parts
      .filter((p) => p.step !== "base" && p.step !== "engraving")
      .map(({ step, label, name, detail, plain, price }) => ({ step, label, name, detail, plain, price })),
    stitching_note: config.stitchingNote,
    engraving: config.engraving,
    engraving_rows: engravingRows(config.engraving),
    brand_count: brandCount(config.engraving),
    config,
    layers: {
      base: baseArtFor(config)?.layerFile ?? null,
      accessories: accessoryLayers(config).map(({ step, key, z }) => ({ step, key, z })),
    },
    unit_price: priced.unitSubtotal,
    line_total: priced.lineSubtotal,
  };
}

/**
 * The orders row for a paid session. Never sets status, tracking_number or
 * internal_notes: those belong to the staff, and a Stripe retry must not
 * reset them.
 *
 * @returns {{row: object, problems: string[]}}
 */
export function buildOrderRecord(session) {
  const s = session || {};
  const md = s.metadata || {};
  const { cart, problems } = parseCartFromMetadata(md);
  const hats = cart.map(hatSnapshot);
  const shipping = addressOf(s);
  const row = {
    stripe_session_id: String(s.id || ""),
    created_at: s.created ? new Date(s.created * 1000).toISOString() : undefined,
    customer_name: s.customer_details?.name || shipping?.name || null,
    customer_email: s.customer_details?.email || null,
    shipping_address: shipping,
    subtotal: firstNumber(s.amount_subtotal, md.subtotal),
    shipping: firstNumber(s.total_details?.amount_shipping, md.shipping),
    total: firstNumber(s.amount_total, md.order_total),
    currency: String(s.currency || "usd").toLowerCase(),
    hats,
    hat_count: hats.reduce((n, h) => n + (Number(h.quantity) || 0), 0),
  };
  if (row.created_at === undefined) delete row.created_at;
  return { row, problems };
}
