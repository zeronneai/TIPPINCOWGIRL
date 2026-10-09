// ---------------------------------------------------------------------------
// THE HATS THE AD BUILDS. Each one is a builder config, exactly what the
// builder stores (see src/shop/pricing.js for every id), so the ad draws it
// with the builder's own layers, z-order and engraving.
//
// To show a different hat, change its ids here (and run `npm run studio` to
// look). Rules the builder enforces apply here too:
//   - straw takes no engraving and no matches ("Strike It Up")
//   - the Prairie Pheasant feather ("natural") covers the front of the
//     crown, so a front engraving would hide under its rosette
// ---------------------------------------------------------------------------

export type HatConfig = {
  hatType: "wool" | "suede" | "straw";
  baseId: string;
  featherId?: string;
  cordId?: string;
  cordColor?: string | null;
  budSize?: string;
  budColor?: string | null;
  matchesColor?: string;
  engraving?: { kind: "text" | "stamp"; text?: string; font?: string; stampId?: string; size: string; position: string }[];
};

/** The hero: wool, and the one that gets engraved. */
export const WOOL: HatConfig = {
  hatType: "wool",
  baseId: "sand",
  featherId: "turquoise",
  budSize: "large",
  budColor: "teal",
};

export const WOOL_ENGRAVING: HatConfig["engraving"] = [
  { kind: "text", text: "JO", font: "durango", size: "large", position: "front" },
  { kind: "stamp", stampId: "horseshoe", size: "small", position: "left" },
];

export const SUEDE: HatConfig = {
  hatType: "suede",
  baseId: "camel",
  featherId: "cream",
  cordId: "concho-silver",
  budSize: "small",
  budColor: "yellow",
};

export const STRAW: HatConfig = {
  hatType: "straw",
  baseId: "cream",
  featherId: "guinea",
  cordId: "leather-rope",
  budSize: "large",
  budColor: "red",
};

/** The three finished hats of the payoff, left to right. */
export const FINISHED: HatConfig[] = [SUEDE, { ...WOOL, engraving: WOOL_ENGRAVING }, STRAW];

/**
 * "Stack your style": one hat, a piece swapped on every beat. Each entry is
 * the whole config at that beat, grouped under the caption it plays with
 * (ad-copy.ts `stack.words`, then `stack.line`).
 */
const M = (patch: Partial<HatConfig>): HatConfig => ({ hatType: "wool", baseId: "black", ...patch });
export const MONTAGE: { word: number; hat: HatConfig; thumb: string }[] = [
  // Feathers.
  { word: 0, hat: M({ featherId: "bronze" }), thumb: "feather-bronze" },
  { word: 0, hat: M({ featherId: "magenta" }), thumb: "feather-magenta" },
  { word: 0, hat: M({ featherId: "polka" }), thumb: "feather-polka" },
  // Cords.
  { word: 1, hat: M({ baseId: "wine", cordId: "concho-turquoise" }), thumb: "cord-concho-turquoise" },
  { word: 1, hat: M({ baseId: "wine", cordId: "heishi" }), thumb: "cord-heishi" },
  { word: 1, hat: M({ baseId: "wine", cordId: "stitching", cordColor: "rust" }), thumb: "cord-stitching-rust" },
  // Florals.
  { word: 2, hat: M({ baseId: "ivory", budSize: "large", budColor: "purple" }), thumb: "bud-large-purple" },
  { word: 2, hat: M({ baseId: "ivory", budSize: "small", budColor: "orange" }), thumb: "bud-small-orange" },
  { word: 2, hat: M({ baseId: "ivory", budSize: "large", budColor: "red" }), thumb: "bud-large-red" },
  // Rhinestones.
  { word: 3, hat: M({ baseId: "black", cordId: "rhinestone" }), thumb: "cord-rhinestone" },
  { word: 3, hat: M({ baseId: "black", cordId: "rhinestone", matchesColor: "red" }), thumb: "matches-red" },
  // Stack your style: everything at once
  { word: 4, hat: M({ baseId: "black", featherId: "magenta", cordId: "rhinestone", budSize: "large", budColor: "red", matchesColor: "pink" }), thumb: "bud-large-red" },
  { word: 4, hat: M({ baseId: "black", featherId: "magenta", cordId: "rhinestone", budSize: "large", budColor: "red", matchesColor: "pink" }), thumb: "matches-pink" },
];
