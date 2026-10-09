// The guide ad's brand: four colors, two fonts, and where things sit on the
// 1080x1920 frame (key text stays between y 250 and y 1570, clear of the
// Reels and TikTok buttons).

export const C = {
  coral: "#E8674A",
  coralDeep: "#B04E28",
  cream: "#FAF1E2",
  ink: "#2B2118",
  // wood for the sign buttons (the site's own .tc-btn browns)
  wood: "#8d5a33",
  woodMid: "#7a4c2a",
  woodDark: "#6f4526",
  woodText: "#f6e7cf",
};

export const FONT = {
  display: "'Alfa Slab One', Georgia, serif",
  body: "'Satoshi', 'Helvetica Neue', Arial, sans-serif",
};

export const W = 1080;
export const H = 1920;
export const SAFE = { top: 250, bottom: 1570 };

/** The headline block: from just under the safe line. */
export const HEAD_TOP = 268;
