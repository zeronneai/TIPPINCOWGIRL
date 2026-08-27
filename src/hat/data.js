// Configurator option data + site content data.

// ---------------------------------------------------------------------------
// Events & pop-ups — add an entry here and drop its media (one .mp4/.webp/
// .jpg/.png) into src/assets/events/<id>/ ; the section renders it with no
// component changes. `featured: true` promotes ONE event to the big
// Grand-Opening slot at the top of the page; remove the flag when the moment
// passes and it flows back into the chapter list automatically.
// ---------------------------------------------------------------------------
export const EVENTS = [
  {
    id: "grand-opening",
    title: "Grand Opening",
    date: "TODO: confirm date", // e.g. "Sat · Sep 14 · 11am to 6pm"
    blurb:
      "TODO: one line about the opening at The Shoppes at Solana. Come build the first hats at the bar.",
    cta: { label: "Book the bar", href: "#events" },
    featured: true,
  },
  // { id: "fall-market", title: "Fall Market Pop-Up", date: "Oct, TBA",
  //   blurb: "One line about it.", },
];

export const FELTS = [
  { id: "ivory", label: "Ivory Wool", sub: "Wool felt", color: "#efe6d2" },
  { id: "tan", label: "Desert Tan", sub: "Wool felt", color: "#d8bd92" },
  { id: "terracotta", label: "Terracotta", sub: "Brushed felt", color: "#c25b34" },
  { id: "rose", label: "Dusty Rose", sub: "Velour felt", color: "#cf8f8a" },
  { id: "sage", label: "Desert Sage", sub: "Wool felt", color: "#9aa57e" },
  { id: "choc", label: "Chocolate", sub: "Beaver felt", color: "#5a3a28" },
  { id: "midnight", label: "Midnight", sub: "Wool felt", color: "#2a2320" },
];

export const BRIMS = [
  { id: "curl", label: "Cowgirl Curl", sub: "Upturned sides", color: "#c79a4e" },
  { id: "flat", label: "Rancher Flat", sub: "Wide & level", color: "#c79a4e" },
  { id: "down", label: "Gambler Dip", sub: "Downturned front", color: "#c79a4e" },
];

export const BANDS = [
  { id: "none", label: "Bare", sub: "No band", color: "transparent" },
  { id: "leather", label: "Tan Leather", sub: "Tooled strip", color: "#a9743f" },
  { id: "turquoise", label: "Turquoise Concho", sub: "Silver & stone", color: "#3fa89a" },
  { id: "beaded", label: "Rose Beadwork", sub: "Hand-beaded", color: "#d98c9a" },
  { id: "horsehair", label: "Horsehair Braid", sub: "Braided", color: "#7a5c44" },
];

export const CHARMS = [
  { id: "none", label: "Clean", sub: "No charm", color: "transparent" },
  { id: "feather", label: "Plume", sub: "Dyed feather", color: "#c25b34" },
  { id: "concho", label: "Silver Concho", sub: "Hammered", color: "#cfd2d6" },
  { id: "bloom", label: "Desert Bloom", sub: "Floral pin", color: "#d98c9a" },
  { id: "star", label: "Lucky Star", sub: "Brass star", color: "#c79a4e" },
];

export function nameOf(arr, id) {
  const f = arr.find((x) => x.id === id);
  return f ? f.label : "";
}

// Lighten (p>0) / darken (p<0) a hex color by ratio p.
export function shade(hex, p) {
  let c = hex.replace("#", "");
  if (c.length === 3) c = c.split("").map((x) => x + x).join("");
  let r = parseInt(c.slice(0, 2), 16),
    g = parseInt(c.slice(2, 4), 16),
    b = parseInt(c.slice(4, 6), 16);
  const t = p < 0 ? 0 : 255,
    a = Math.abs(p);
  r = Math.round((t - r) * a + r);
  g = Math.round((t - g) * a + g);
  b = Math.round((t - b) * a + b);
  return `rgb(${r},${g},${b})`;
}
