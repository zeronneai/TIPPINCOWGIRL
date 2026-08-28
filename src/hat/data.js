// Configurator option data + site content data.

// ---------------------------------------------------------------------------
// Remote media (Cloudinary). The real content lives on Cloudinary, NOT in the
// repo; local files in src/assets/ remain as overrides (local wins when both
// exist). Optimization transforms are injected into every URL after /upload/:
// images f_auto,q_auto,w_1600 (w_800 for gallery/extras), videos
// f_auto,q_auto,w_1280, and the hero poster is frame zero of the hero video
// (so_0) delivered as jpg.
// ---------------------------------------------------------------------------
const CLD = "https://res.cloudinary.com/dsprn0ew4";
const cldImg = (path, w = 1600) => `${CLD}/image/upload/f_auto,q_auto,w_${w}/${path}`;
const cldVid = (path) => `${CLD}/video/upload/f_auto,q_auto,w_1280/${path}`;
const cldPoster = (path) =>
  `${CLD}/video/upload/so_0,f_auto,q_auto,w_1280/${path.replace(/\.mp4$/, ".jpg")}`;

const HERO_CLIP = "v1787954335/Horseback_-_Tippin_x_HoB_qdpgsu.mp4";

export const REMOTE_MEDIA = {
  heroVideo: cldVid(HERO_CLIP),
  heroPoster: cldPoster(HERO_CLIP),
  deborah: cldImg("v1787954497/26072026-NZR_8425_yxijsp.jpg"),
  gallery: {
    "01": { video: cldVid("v1787954343/UTEP_Hat_-_Tippin_cshbzm.mp4"), caption: "Custom UTEP build" },
    "02": {
      video: cldVid("v1787954349/Dallas_Cowboys_Hat_1_iovxcw.mp4"),
      caption: "Custom Cowboys build",
    },
    "03": { image: cldImg("v1787954494/NZR_8627_ravngt.jpg", 800) },
    "04": { image: cldImg("v1787954514/26072026-NZR_8159_ii0xav.jpg", 800) },
    "05": { image: cldImg("v1787954495/NZR_7116_n4j27w.jpg", 800) },
  },
};

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
    // media pending: drop a file in src/assets/events/grand-opening/
  },
  {
    id: "stride-swim-elmont",
    title: "Stride & Swim at The Elmont",
    date: "July 2026",
    blurb: "The hat bar poolside at The Elmont. Felts, bands and charms in the summer sun.",
    media: {
      main: cldImg("v1787954497/29072026-NZR_8890_rhhflb.jpg"),
      extras: [
        cldImg("v1787954493/NZR_8689_sjnnzd.jpg", 800),
        cldImg("v1787954493/NZR_8666_onavdj.jpg", 800),
      ],
    },
  },
  {
    id: "tippin-x-house-of-beauty",
    title: "Tippin' x House of Beauty",
    date: "July 26, 2026",
    blurb: "A collab pop-up with House of Beauty. Custom hats to match fresh looks.",
    media: {
      main: cldImg("v1787954552/26072026-NZR_8266_xzjmyo.jpg"),
      extras: [
        cldImg("v1787954552/26072026-NZR_8445_ehln2u.jpg", 800),
        cldImg("v1787954552/26072026-NZR_8161_zo0yn4.jpg", 800),
      ],
    },
  },
  {
    id: "hat-bar-popups",
    title: "Hat Bar Pop-Ups",
    date: "Recurring",
    blurb: "The bar keeps rolling around El Paso. Catch the next one on Instagram.",
    media: {
      main: cldImg("v1787954494/NZR_7221_mkcxrk.jpg"),
      extras: [
        cldImg("v1787954494/NZR_7104_mcvmgd.jpg", 800),
        cldImg("v1787954494/NZR_7172_ra1dq1.jpg", 800),
      ],
    },
  },
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
