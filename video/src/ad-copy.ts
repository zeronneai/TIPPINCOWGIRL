// ---------------------------------------------------------------------------
// EVERY CAPTION IN THE HAT BUILDER AD LIVES HERE (all three versions).
//
// Change a line here and it changes everywhere. Keep them short: the
// headlines are set very large. No long dashes. Prices never go here: they
// come from src/shop/pricing.js; write {price} where one should appear.
//
// Only say what the site says: no reviews, ratings, counts, delivery times,
// discounts, free shipping or handmade claims.
// ---------------------------------------------------------------------------

export const adCopy = {
  hook: {
    lines: ["Your hat.", "Your rules."],
  },

  desire: {
    line: "Every cowgirl deserves a hat that's hers.",
  },

  builder: {
    line: "Design it in minutes",
    // the small label over each builder screen, by screenshot
    steps: {
      "type-wool": "Pick your hat",
      color: "Choose the color",
      feather: "Add a feather",
      bud: "Pin a bloom",
      engraving: "Engrave it",
      size: "Find your size",
      cart: "Add to cart",
    },
    types: "Wool. Faux suede. Straw.",
    // under each hat type; {price} is that type's price from pricing.js
    from: "from {price}",
  },

  stack: {
    words: ["Feathers.", "Cords.", "Florals.", "Rhinestones."],
    line: "Stack your style.",
  },

  personal: {
    line: "Make it unmistakably yours.",
    tag: "Engraving",
  },

  payoff: {
    line: "Don't just wear a hat.",
    punch: "Tip it.",
  },

  cta: {
    line: "Design yours at",
    url: "tippincowgirl.com",
    // {price} is the lowest hat price in pricing.js
    price: "Starting at {price}",
    button: "Build your hat",
  },
} as const;
