// Configurator option data — ported verbatim from the Design Component.

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

export const BRIM_PATHS = {
  curl: "M52,256 C76,238 124,240 154,252 C184,264 236,264 266,252 C296,240 344,238 368,256 C356,278 298,290 210,290 C122,290 64,278 52,256 Z",
  flat: "M40,260 C92,250 150,259 210,260 C270,259 328,250 380,260 C366,278 300,286 210,286 C120,286 54,278 40,260 Z",
  down: "M62,248 C86,242 128,254 158,264 C188,274 232,274 262,264 C292,254 334,242 358,248 C350,276 294,296 210,296 C126,296 70,276 62,248 Z",
};

export const CROWN =
  "M132,250 C130,198 138,150 160,116 Q186,136 210,140 Q234,136 260,116 C282,150 290,198 288,250 Q210,264 132,250 Z";

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

export function starPath(cx, cy, R, N) {
  let p = "";
  const r = R * 0.42;
  for (let i = 0; i < N * 2; i++) {
    const rad = i % 2 === 0 ? R : r,
      a = (Math.PI / N) * i - Math.PI / 2;
    const x = cx + Math.cos(a) * rad,
      y = cy + Math.sin(a) * rad;
    p += (i === 0 ? "M" : "L") + x.toFixed(1) + "," + y.toFixed(1);
  }
  return p + "Z";
}
