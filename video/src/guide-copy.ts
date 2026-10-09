// ---------------------------------------------------------------------------
// EVERY LINE IN THE GUIDED JOURNEY AD (ad-guide-a, -b, -c and ad-guide-15)
// LIVES HERE, including the three hooks.
//
// Headlines are sticker type, stacked: each string in a `lines` array is
// one line on screen, so you decide where a line breaks. Keep them short
// (about 16 letters a line). Wrap a word in *stars* to draw a hand-drawn
// underline under it. No long dashes.
//
// Prices never go here: write {price} and the lowest hat price comes from
// src/shop/pricing.js. Only say what the site says: no reviews, ratings,
// counts, discounts, free shipping or delivery times.
// ---------------------------------------------------------------------------

export const guideCopy = {
  // the first ~2 seconds; the rest of the ad is the same for all three
  hooks: {
    a: { lines: ["This hat", "didn't exist", "*10 seconds* ago."] },
    b: { lines: ["POV: you just", "designed your", "own *cowboy hat*."] },
    c: { lines: ["El Paso,", "you can build", "your own *hat* now."] },
  },

  arrival: { lines: ["Welcome to", "El Paso's first", "*hat bar*."] },

  scroll: { lines: ["Your hat.", "Your *rules*."] },

  intoBuilder: { lines: ["Build it", "*right here*."] },

  build: {
    base: { lines: ["Pick your", "*base*."] },
    stack: { lines: ["Stack your", "*style*."] },
    yours: { lines: ["Make it", "unmistakably", "*yours*."] },
    // the small label on each full screen hat: the type's name from pricing.js
    // and its price ({price})
    typeTag: "{type} from {price}",
  },

  cart: {
    lines: ["Designed", "*by you*."],
    // {price} is the lowest hat price in pricing.js
    price: "Hats starting at {price}",
  },

  bookings: { lines: ["Bring the hat bar", "to your *party*."] },

  end: {
    line: "Design yours at",
    url: "tippincowgirl.com",
    button: "Build your hat",
  },
} as const;
