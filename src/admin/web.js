// The website numbers for /admin/website, shaped from what /api/web-stats
// returns (Roots Engine's summary, whose labels are in Spanish). Pure, so it
// is tested in tests/web-stats.test.mjs.

export const WEB_RANGES = [
  { days: 1, label: "Today" },
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
];

const DEVICES = { Celular: "Phone", Compu: "Computer", Tablet: "Tablet" };
const DEVICE_COLORS = { Phone: "#e8674a", Computer: "#33609f", Tablet: "#22a493" };

/** "Directo" and "Instagram (anuncio)" in English; everything else as is. */
export function sourceName(name) {
  if (name === "Directo") return "Direct (typed or saved link)";
  return String(name || "").replace(/\(anuncio\)/, "(ad)");
}

const clickName = (name) => String(name || "").replace(/^Botón sin texto \(ícono o flecha\)$/, "Button with no text (icon or arrow)").replace(/^Botón:\s*/, "");

/** "1m 05s" style time on page. */
export function duration(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
}

const dayLabel = (iso) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
};

/** Everything the screen draws, from the API payload. */
export function shapeWebStats(payload) {
  const s = payload?.stats || {};
  const list = (arr) => (Array.isArray(arr) ? arr : []);
  const devices = list(s.devices).map((d) => {
    const name = DEVICES[d.name] || d.name;
    return { id: name, name, value: d.n, color: DEVICE_COLORS[name] || "#9a8f86" };
  });
  return {
    domain: payload?.domain || "tippincowgirl.com",
    days: payload?.days || 7,
    liveNow: payload?.live?.active || 0,
    livePages: list(payload?.live?.pages).map((p) => ({ label: p.name, value: p.n })),
    k: {
      visitors: s.visitors || 0,
      sessions: s.sessions || 0,
      pageviews: s.pageviews || 0,
      avgTime: duration(s.avgSessionSeconds),
      bounceRate: s.bounceRate || 0,
    },
    series: list(s.series).map((x) => ({ key: x.day, label: dayLabel(x.day), value: x.visitors, views: x.views })),
    sources: list(s.sources).map((x) => ({ label: sourceName(x.name), value: x.n })),
    devices,
    cities: list(s.cities).map((x) => ({ label: x.name, value: x.n })),
    clicks: list(s.clicks).map((x) => ({ label: clickName(x.name), value: x.n })),
    pages: list(s.pages).slice(0, 12).map((p) => ({ path: p.path, title: p.title, views: p.views, visitors: p.visitors, time: duration(p.avgSeconds) })),
    empty: !(s.pageviews > 0),
  };
}
