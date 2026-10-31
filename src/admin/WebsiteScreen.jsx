import { useEffect, useState } from "react";
import { ChartCard, ColumnChart, Donut, HBars } from "./charts.jsx";
import { supabase } from "./supabase.js";
import { Empty, Icon, PageHead, Skeleton } from "./ui.jsx";
import { WEB_RANGES, shapeWebStats } from "./web.js";

// /admin/website: who visits tippincowgirl.com. The numbers come from
// Roots Engine through api/web-stats.js, which checks the staff sign in and
// keeps the read token on the server. Refreshes every minute while open.

const CORAL = "#e8674a";
const TEAL = "#22a493";
const REFRESH_MS = 60_000;

const PAGE_NAMES = {
  "/": "Home",
  "/events": "Events",
  "/bringyourboo": "Bring Your Boo",
  "/order-confirmed": "Order confirmed",
  "/checkout-cancelled": "Checkout cancelled",
  "/giveaway": "Giveaway",
};
const pageName = (p) => PAGE_NAMES[p.path] || p.title || p.path;

export default function WebsiteScreen() {
  const [days, setDays] = useState(7);
  const [state, setState] = useState({ loading: true, data: null, error: "", setup: false });

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const { data: s } = await supabase.auth.getSession();
        const r = await fetch(`/api/web-stats?days=${days}`, { headers: { Authorization: `Bearer ${s.session?.access_token || ""}` } });
        const body = await r.json().catch(() => ({}));
        if (!alive) return;
        if (!r.ok) setState({ loading: false, data: null, error: body.error || "Could not load the website numbers.", setup: !!body.setup });
        else setState({ loading: false, data: shapeWebStats(body), error: "", setup: false });
      } catch {
        if (alive) setState({ loading: false, data: null, error: "Could not load the website numbers. Check the connection.", setup: false });
      }
    };
    setState((x) => ({ ...x, loading: true }));
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [days]);

  const v = state.data;
  return (
    <>
      <PageHead
        title="Website"
        sub="Who visits tippincowgirl.com, where they come from and what they look at."
        actions={
          <div className="ad-chips" role="group" aria-label="Period">
            {WEB_RANGES.map((r) => (
              <button key={r.days} type="button" className="ad-fchip" aria-pressed={days === r.days} data-range={r.days} onClick={() => setDays(r.days)}>
                {r.label}
              </button>
            ))}
          </div>
        }
      />

      {state.error ? (
        <div className="ad-card">
          <Empty icon={state.setup ? "settings" : "alert"} title={state.setup ? "Website numbers are not connected yet" : "Could not load the numbers"}>
            {state.setup ? "Your agency needs to connect them once. Nothing to do on your side." : state.error}
          </Empty>
        </div>
      ) : !v ? (
        <div className="ad-kpis">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="ad-card ad-kpi">
              <Skeleton h={14} w="60%" />
              <Skeleton h={30} w="40%" style={{ marginTop: 12 }} />
            </div>
          ))}
        </div>
      ) : (
        <Body v={v} />
      )}
    </>
  );
}

function Kpi({ id, label, value, sub, icon, color = CORAL, bg = "#fde3da", ink = "#8f3416" }) {
  return (
    <div className="ad-card ad-kpi" data-kpi={id} style={{ "--kpi": color, "--kpi-bg": bg, "--kpi-ink": ink }}>
      <div className="ad-kpi-top">
        <span className="ad-kpi-label">{label}</span>
        <span className="ad-kpi-icon">
          <Icon name={icon} size={17} />
        </span>
      </div>
      <div className="ad-kpi-value" data-kpi-value>
        {value}
      </div>
      <div className="ad-kpi-sub">{sub}</div>
    </div>
  );
}

function Body({ v }) {
  const range = WEB_RANGES.find((r) => r.days === v.days)?.label.toLowerCase() || `${v.days} days`;
  const period = v.days === 1 ? "in the last 24 hours" : `in the last ${range}`;
  return (
    <>
      <p className="ad-live" data-live>
        <span className="ad-dot" style={{ background: v.liveNow ? TEAL : "#9a8f86" }} aria-hidden />
        {v.liveNow ? (
          <>
            <b>{v.liveNow}</b> {v.liveNow === 1 ? "person is" : "people are"} on the site right now
            {v.livePages.length ? `, looking at ${v.livePages.map((p) => PAGE_NAMES[p.label] || p.label).join(", ")}` : ""}
          </>
        ) : (
          "Nobody on the site right now"
        )}
      </p>

      <div className="ad-kpis">
        <Kpi id="visitors" label="Visitors" value={v.k.visitors} sub={`different people ${period}`} icon="spark" />
        <Kpi id="visits" label="Visits" value={v.k.sessions} sub="times they came in" icon="inbox" color="#33609f" bg="#dfe8f5" ink="#22416d" />
        <Kpi id="pageviews" label="Pages seen" value={v.k.pageviews} sub="pages opened in total" icon="bookings" color="#b04e28" />
        <Kpi id="time" label="Time on site" value={v.k.avgTime} sub="average per visit" icon="clock" color={TEAL} bg="#d5f0eb" ink="#11685d" />
        <Kpi id="bounce" label="Left right away" value={`${v.k.bounceRate}%`} sub="saw one page, under 10 seconds" icon="out" color="#9a8f86" bg="#efe8df" ink="#5b4535" />
      </div>

      {v.empty ? (
        <div className="ad-card">
          <Empty icon="spark" title={`No visits ${period}`}>Visits show up here a few seconds after someone opens the site.</Empty>
        </div>
      ) : (
        <div className="ad-stack">
          {v.days > 1 && (
            <ChartCard id="web-days" title="Visitors per day" sub={`Different people each day, ${range}`} table={{ head: ["Day", "Visitors", "Pages seen"], rows: v.series.map((d) => [d.label, d.value, d.views]) }}>
              <ColumnChart data={v.series} color={CORAL} name="Visitors per day" format={(n) => String(Math.round(n))} />
            </ChartCard>
          )}

          <div className="ad-pair">
            <ChartCard id="web-sources" title="Where they come from" sub="How each visit started" table={{ head: ["Source", "Visits"], rows: v.sources.map((x) => [x.label, x.value]) }}>
              <HBars data={v.sources} color={CORAL} />
            </ChartCard>
            <ChartCard id="web-devices" title="Phone or computer" sub="Device of each visit" table={{ head: ["Device", "Visits"], rows: v.devices.map((x) => [x.name, x.value]) }}>
              <Donut data={v.devices} centerLabel="visits" />
            </ChartCard>
          </div>

          <ChartCard id="web-pages" title="Most seen pages" sub="Pages opened and how long people stayed" empty={!v.pages.length && <Empty title="No pages yet" />}>
            <div className="ad-table-wrap">
              <table className="ad-table">
                <thead>
                  <tr>
                    <th scope="col">Page</th>
                    <th scope="col">Views</th>
                    <th scope="col">People</th>
                    <th scope="col">Avg time</th>
                  </tr>
                </thead>
                <tbody>
                  {v.pages.map((p) => (
                    <tr key={p.path}>
                      <th scope="row" style={{ textAlign: "left", textTransform: "none", letterSpacing: 0, color: "#2b1a10", fontSize: 13.5 }}>
                        {pageName(p)}
                        <div className="ad-muted" style={{ fontWeight: 400, fontSize: 12 }}>{p.path}</div>
                      </th>
                      <td>{p.views}</td>
                      <td>{p.visitors}</td>
                      <td>{p.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>

          <div className="ad-pair">
            <ChartCard id="web-cities" title="Cities" sub="Where page views came from" table={{ head: ["City", "Page views"], rows: v.cities.map((x) => [x.label, x.value]) }} empty={!v.cities.length && <Empty title="No cities yet" />}>
              <HBars data={v.cities} color={TEAL} />
            </ChartCard>
            <ChartCard id="web-clicks" title="What people tap" sub="Buttons, calls, WhatsApp and links" table={{ head: ["Button", "Taps"], rows: v.clicks.map((x) => [x.label, x.value]) }} empty={!v.clicks.length && <Empty title="No taps yet" />}>
              <HBars data={v.clicks} color="#b04e28" />
            </ChartCard>
          </div>
        </div>
      )}
    </>
  );
}
