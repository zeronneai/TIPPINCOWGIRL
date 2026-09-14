// ---------------------------------------------------------------------------
// Shop catalog: the single source of truth for the hat builder.
//
// Layer images live in src/shop/layers/ as full-canvas (1600x1600) files with
// transparent backgrounds, one per item, named <category>-<id>. Today they
// are placeholder SVGs drawn at the real positions; when the product photos
// arrive as PNGs of the same canvas size, drop them next to the SVGs with the
// same name (e.g. base-ivory.png) and they take over automatically, no code
// changes (PNG wins over SVG below).
// ---------------------------------------------------------------------------

export const CURRENCY = "USD";
export const CANVAS = { w: 1600, h: 1600 };

// Stacking order per category on the stage.
export const Z_INDEX = { base: 10, brand: 20, band: 30, charm: 40 };

// Flat-rate shipping; free above the threshold. Amounts in whole USD.
export const SHIPPING = { flat: 12, freeOver: 250 };

// PNG (real photo) beats SVG (placeholder) for the same layer key.
const LAYER_FILES = import.meta.glob("./layers/*.{png,svg}", {
  eager: true,
  query: "?url",
  import: "default",
});
const layerUrl = (key) => LAYER_FILES[`./layers/${key}.png`] || LAYER_FILES[`./layers/${key}.svg`] || null;

const item = (id, name, price, layerKey) => ({
  id,
  name,
  price,
  layerImg: layerKey ? layerUrl(layerKey) : null,
  thumbImg: layerKey ? layerUrl(layerKey) : null, // dedicated thumbs can override later
});

export const BASES = [
  item("ivory", "Ivory Wool", 98, "base-ivory"),
  item("tan", "Desert Tan", 98, "base-tan"),
  item("terracotta", "Terracotta", 98, "base-terracotta"),
  item("rose", "Dusty Rose", 105, "base-rose"),
  item("midnight", "Midnight", 105, "base-midnight"),
];

export const BANDS = [
  item("none", "No band", 0, null),
  item("leather", "Tan Leather", 12, "band-leather"),
  item("turquoise", "Turquoise Concho", 18, "band-turquoise"),
  item("beaded", "Rose Beadwork", 16, "band-beaded"),
  item("horsehair", "Horsehair Braid", 14, "band-horsehair"),
];

export const CHARMS = [
  item("none", "No charm", 0, null),
  item("feather", "Plume", 8, "charm-feather"),
  item("concho", "Silver Concho", 10, "charm-concho"),
  item("bloom", "Desert Bloom", 9, "charm-bloom"),
  item("star", "Lucky Star", 8, "charm-star"),
];

// Fire-branded marks on the crown front.
export const BRANDS = [
  item("none", "No brand", 0, null),
  item("lonestar", "Lone Star", 12, "brand-lonestar"),
  item("horseshoe", "Horseshoe", 12, "brand-horseshoe"),
  item("cactus", "Cactus", 12, "brand-cactus"),
];

export const SIZES = [
  { id: "s", name: "S", cm: "54 to 55 cm" },
  { id: "m", name: "M", cm: "56 to 57 cm" },
  { id: "l", name: "L", cm: "58 to 59 cm" },
  { id: "xl", name: "XL", cm: "60 to 61 cm" },
];

export const SIZE_GUIDE = {
  title: "Find your size",
  howTo: [
    "Take a soft measuring tape (or a piece of string you can measure after).",
    "Wrap it around your head just above your eyebrows and ears, where a hat naturally sits.",
    "Keep it snug but comfortable, not tight. Note the number in centimeters.",
    "Between two sizes? Go with the larger one. Felt settles in as you wear it.",
  ],
  rows: [
    { size: "S", cm: "54 to 55 cm", inches: '21.3 to 21.7 in' },
    { size: "M", cm: "56 to 57 cm", inches: '22.0 to 22.4 in' },
    { size: "L", cm: "58 to 59 cm", inches: '22.8 to 23.2 in' },
    { size: "XL", cm: "60 to 61 cm", inches: '23.6 to 24.0 in' },
  ],
};

export const CATEGORIES = [
  { key: "base", label: "Base", options: BASES, required: true },
  { key: "band", label: "Band", options: BANDS },
  { key: "charm", label: "Charm", options: CHARMS },
  { key: "brand", label: "Brand", options: BRANDS },
];

export const findIn = (options, id) => options.find((o) => o.id === id) || null;
