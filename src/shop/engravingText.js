// ---------------------------------------------------------------------------
// The engraving in words, for people: "DEB (Durango, large)" and the rows
// both emails print. Pure; the server imports it for the emails and the
// browser only with the Brand it step, so the stamp names never weigh on
// the main bundle (pricing.js keeps just the ids).
// ---------------------------------------------------------------------------

import { ENGRAVING_STAMPS } from "./engravingStamps.js";
import { ENGRAVING_FONTS, ENGRAVING_POSITIONS, ENGRAVING_SIZES, brandCount, engravingPrice, formatCents, normalizeEngraving } from "./pricing.js";

const nameOf = (list, id) => list.find((o) => o.id === id)?.name;

/** "DEB (Durango, large)" or "Longhorn (large)". */
export function describeEngravingElement(e) {
  const size = nameOf(ENGRAVING_SIZES, e.size)?.toLowerCase() ?? e.size;
  if (e.kind === "stamp") return `${nameOf(ENGRAVING_STAMPS, e.stampId) ?? e.stampId} (${size})`;
  return `${e.text} (${nameOf(ENGRAVING_FONTS, e.font) ?? e.font}, ${size})`;
}

/**
 * The engraving as the maker reads it, one row per position plus the count:
 *   ["Front", "DEB (Durango, large) + Longhorn (large)"]
 *   ["Left", "Horseshoe (small)"]
 *   ["Branding", "5 brands, unlimited +$10"]
 */
export function engravingRows(engraving) {
  const list = normalizeEngraving(engraving);
  if (!list.length) return [];
  const rows = ENGRAVING_POSITIONS.map((p) => [p.name, list.filter((e) => e.position === p.id)])
    .filter(([, els]) => els.length)
    .map(([name, els]) => [name, els.map(describeEngravingElement).join(" + ")]);
  const n = brandCount(list);
  const price = engravingPrice(list);
  rows.push(["Branding", `${n} brand${n === 1 ? "" : "s"}, ${price ? `unlimited +${formatCents(price)}` : "free"}`]);
  return rows;
}
