// ---------------------------------------------------------------------------
// Add-ons for private events at the hat bar: the two menus Deborah offers
// (charcuterie, and desserts by Choc Oh! Berry). Shared by the booking
// drawer (what the visitor picks) and api/_lib/bookings.js (what is
// stored), so a price or a minimum lives in exactly one place.
//
// Prices are an estimate for the visitor. Deborah confirms the final total
// when she reaches out; nothing here is charged.
//
// To change the menu: edit ADDON_GROUPS. Ids are stored with each booking,
// so rename the name freely but keep an id once bookings use it.
// ---------------------------------------------------------------------------

export const ADDON_GROUPS = [
  {
    id: "charcuterie",
    title: "Charcuterie",
    note: "10 item minimum (cups and boxes together). Delivery included.",
    minTotal: 10,
    items: [
      {
        id: "charcuterie-cups",
        name: "Charcuterie Cups",
        detail: "Individually wrapped, tied with ribbon, with a custom sticker for your event.",
        priceCents: 1100,
        unit: "each",
        max: 300,
      },
      {
        id: "charcuterie-boxes",
        name: "Individual Charcuterie Boxes",
        detail: "Tied with ribbon, with a custom sticker for your event.",
        priceCents: 1600,
        unit: "each",
        max: 300,
      },
    ],
    // not priced: a yes/no that asks Deborah for a quote
    quote: {
      id: "charcuterie-board",
      name: "A larger board instead",
      detail: "Tell us what you have in mind and we will quote it.",
    },
  },
  {
    id: "desserts",
    title: "Desserts by Choc Oh! Berry",
    note: "Chocolate or vanilla. Tell us your flavors and colors in the notes.",
    minTotal: 0,
    items: [
      {
        id: "vintage-cake",
        name: "White Vintage Cake",
        detail: "Feeds 6 to 10. Themed details and a small message.",
        priceCents: 5000,
        unit: "cake",
        max: 10,
      },
      {
        id: "cupcakes",
        name: "Cupcakes",
        detail: "A dozen, with themed details.",
        priceCents: 2000,
        unit: "dozen",
        max: 20,
      },
      {
        id: "dessert-shooters",
        name: "Dessert Shooters",
        detail: "A dozen, with themed details.",
        priceCents: 4000,
        unit: "dozen",
        max: 20,
      },
      {
        id: "chocolate-strawberries",
        name: "Chocolate Covered Strawberries",
        detail: "A dozen, in white, gold or brown, themed.",
        priceCents: 3500,
        unit: "dozen",
        max: 20,
      },
    ],
  },
];

export const ADDON_ITEMS = ADDON_GROUPS.flatMap((g) => g.items.map((it) => ({ ...it, group: g.id })));
const BY_ID = new Map(ADDON_ITEMS.map((it) => [it.id, it]));
const QUOTE_IDS = new Set(ADDON_GROUPS.filter((g) => g.quote).map((g) => g.quote.id));

export const money = (cents) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;

/**
 * Whatever the form (or anyone) sent, as a clean selection.
 *
 * Accepts { qty: { [itemId]: number }, quotes: [quoteId] }. Unknown ids,
 * non numbers and zeros are dropped; quantities are whole and capped.
 *
 * @returns {{ items: Array<{id,name,unit,qty,unitPriceCents,lineCents}>,
 *             quotes: Array<{id,name}>, estimateCents: number,
 *             errors: Object<string,string>, empty: boolean }}
 */
export function normalizeAddons(input) {
  const src = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const qty = src.qty && typeof src.qty === "object" && !Array.isArray(src.qty) ? src.qty : {};
  const items = [];
  for (const it of ADDON_ITEMS) {
    const n = Math.floor(Number(qty[it.id]));
    if (!Number.isFinite(n) || n <= 0) continue;
    const q = Math.min(n, it.max);
    items.push({ id: it.id, name: it.name, unit: it.unit, qty: q, unitPriceCents: it.priceCents, lineCents: q * it.priceCents });
  }
  const quoteList = Array.isArray(src.quotes) ? src.quotes : [];
  const quotes = ADDON_GROUPS.filter((g) => g.quote && quoteList.includes(g.quote.id) && QUOTE_IDS.has(g.quote.id)).map((g) => ({
    id: g.quote.id,
    name: g.quote.name,
  }));

  const errors = {};
  for (const g of ADDON_GROUPS) {
    if (!g.minTotal) continue;
    const total = items.filter((i) => BY_ID.get(i.id).group === g.id).reduce((s, i) => s + i.qty, 0);
    if (total > 0 && total < g.minTotal) errors[g.id] = `${g.title} has a ${g.minTotal} item minimum (you have ${total}).`;
  }

  const estimateCents = items.reduce((s, i) => s + i.lineCents, 0);
  return { items, quotes, estimateCents, errors, empty: !items.length && !quotes.length };
}

/** One line a person can read in a spreadsheet cell or an email. */
export function addonsSummary(sel) {
  if (!sel || sel.empty) return "";
  const parts = sel.items.map((i) => `${i.name} x ${i.qty}${i.unit === "each" ? "" : ` ${i.unit}`} (${money(i.lineCents)})`);
  for (const q of sel.quotes) parts.push(`${q.name} (quote)`);
  const est = sel.estimateCents ? `. Estimate ${money(sel.estimateCents)}` : "";
  return `${parts.join("; ")}${est}`;
}

/** What is stored in bookings.add_ons (jsonb). */
export function addonsRecord(sel) {
  if (!sel || sel.empty) return null;
  return {
    items: sel.items.map(({ id, name, unit, qty, unitPriceCents, lineCents }) => ({ id, name, unit, qty, unitPriceCents, lineCents })),
    quotes: sel.quotes.map(({ id, name }) => ({ id, name })),
    estimateCents: sel.estimateCents,
  };
}
