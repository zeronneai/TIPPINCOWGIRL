import { useEffect, useMemo, useState } from "react";
import { ChartCard, ColumnChart, Donut, HBars } from "./charts.jsx";
import { ago, bookingStatusOf, money, moneyShort, statusOf } from "./format.js";
import { activity, attention, bookingMonths, eventTypes, kpis, orderStatusCounts, weekly, withDemo } from "./stats.js";
import { supabase } from "./supabase.js";
import { Empty, Icon, PageHead, Skeleton, StatusBadge, useDemo } from "./ui.jsx";

// The home screen: the headline numbers, what is waiting too long, the
// charts and the latest changes. Everything comes from four reads (orders,
// bookings and their two histories) and is counted here, so the demo switch
// redraws it at once without asking the database again.

const ORDER_COLS = "id, created_at, customer_name, customer_email, status, total, currency, hat_count";
const BOOKING_COLS = "id, created_at, name, email, event_type, event_date, proposed_date, status";
const EVENT_COLS = "id, created_at, actor_email, from_status, to_status, note";
const CORAL = "#e8674a";
const TEAL = "#22a493";

export default function Dashboard() {
  const { includeDemo } = useDemo();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([
      supabase.from("orders").select(ORDER_COLS).order("created_at", { ascending: false }).limit(2000),
      supabase.from("bookings").select(BOOKING_COLS).order("created_at", { ascending: false }).limit(2000),
      supabase.from("order_events").select(`${EVENT_COLS}, order_id`).order("created_at", { ascending: false }).limit(60),
      supabase.from("booking_events").select(`${EVENT_COLS}, booking_id`).order("created_at", { ascending: false }).limit(60),
    ]).then(([o, b, oe, be]) => {
      if (!alive) return;
      if (o.error || b.error) {
        setError("The dashboard could not be loaded. Try again in a moment.");
        return;
      }
      setData({ orders: o.data || [], bookings: b.data || [], orderEvents: oe.data || [], bookingEvents: be.data || [] });
    });
    return () => {
      alive = false;
    };
  }, []);

  const now = Date.now();
  const view = useMemo(() => {
    if (!data) return null;
    const { orders, bookings } = withDemo(data, includeDemo);
    return {
      orders,
      bookings,
      k: kpis({ orders, bookings, now }),
      attn: attention({ orders, bookings, now }),
      weeks: weekly({ orders, now }),
      statuses: orderStatusCounts(orders).map((s) => ({ id: s.id, name: s.name, color: s.color, value: s.value })),
      months: bookingMonths({ bookings, now }),
      types: eventTypes(bookings),
      feed: activity({ ...data, orders, bookings, limit: 10 }),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, includeDemo]);

  const today = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date());

  return (
    <>
      <PageHead title="Dashboard" sub={`${today}. Orders and bookings at a glance.`} watermark />
      {error && (
        <p role="alert" className="ad-msg-err">
          {error}
        </p>
      )}
      {!view && !error && <DashboardSkeleton />}
      {view && <Body view={view} includeDemo={includeDemo} />}
    </>
  );
}

function Kpi({ id, label, value, sub, icon, color, bg, ink, href }) {
  return (
    <a className="ad-card ad-kpi" href={href} data-kpi={id} style={{ "--kpi": color, "--kpi-bg": bg, "--kpi-ink": ink }}>
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
    </a>
  );
}

function Body({ view, includeDemo }) {
  const { k, attn, weeks, statuses, months, types, feed, orders, bookings } = view;
  const s = (id) => statusOf(id);
  const noOrdersInWeeks = weeks.every((w) => w.orders === 0);
  const noMonths = months.every((m) => m.value === 0);
  return (
    <>
      <div className="ad-kpis">
        <Kpi id="new-orders" label="New orders" value={k.newOrders} sub="waiting to start" icon="orders" color={s("new").color} bg={s("new").bg} ink={s("new").ink} href="/admin/orders" />
        <Kpi
          id="in-production"
          label="In production"
          value={k.inProduction}
          sub="hats being made"
          icon="hat"
          color={s("in_production").color}
          bg={s("in_production").bg}
          ink={s("in_production").ink}
          href="/admin/orders"
        />
        <Kpi
          id="revenue"
          label="Revenue"
          value={moneyShort(k.revenueMonth)}
          sub={`${k.monthLabel}, ${k.ordersMonth} order${k.ordersMonth === 1 ? "" : "s"}`}
          icon="money"
          color="#b04e28"
          bg="#fde3da"
          ink="#8f3416"
          href="/admin/orders"
        />
        <Kpi
          id="new-bookings"
          label="New bookings"
          value={k.newBookings}
          sub="to answer"
          icon="bookings"
          color={bookingStatusOf("rescheduled").color}
          bg={bookingStatusOf("rescheduled").bg}
          ink={bookingStatusOf("rescheduled").ink}
          href="/admin/bookings"
        />
        <Kpi
          id="upcoming"
          label="Next 30 days"
          value={k.upcomingEvents}
          sub={`event${k.upcomingEvents === 1 ? "" : "s"}, ${k.upcomingConfirmed} confirmed`}
          icon="calendar"
          color="#33609f"
          bg="#dfe8f5"
          ink="#22416d"
          href="/admin/calendar"
        />
      </div>

      <div className="ad-dash">
        <div className="ad-stack">
          <ChartCard
            id="weekly"
            title="Revenue and orders per week"
            sub="Last 12 weeks, what Stripe charged (cancelled orders left out)"
            table={{ head: ["Week of", "Revenue", "Orders"], rows: weeks.map((w) => [w.label, money(w.revenue), w.orders]) }}
            empty={noOrdersInWeeks && <Empty icon="money" title="No orders in the last 12 weeks">Paid orders appear here week by week.</Empty>}
          >
            <div className="ad-pair">
              <div>
                <div className="ad-label">Revenue</div>
                <ColumnChart data={weeks.map((w) => ({ key: w.key, label: w.label, value: w.revenue }))} color={CORAL} format={money} axisFormat={moneyShort} name="Revenue per week" tipLabel={(d) => `Week of ${d.label}`} />
              </div>
              <div>
                <div className="ad-label">Orders</div>
                <ColumnChart data={weeks.map((w) => ({ key: w.key, label: w.label, value: w.orders }))} color="#b04e28" format={(v) => String(Math.round(v))} name="Orders per week" tipLabel={(d) => `Week of ${d.label}`} />
              </div>
            </div>
          </ChartCard>

          <ChartCard
            id="months"
            title="Bookings by event month"
            sub="The next 12 months, by the day each event should happen (declined left out)"
            table={{ head: ["Month", "Bookings"], rows: months.map((m) => [`${m.label} ${m.year}`, m.value]) }}
            empty={noMonths && <Empty icon="calendar" title="Nothing on the calendar yet">Booking requests with a date show up here by month.</Empty>}
          >
            <ColumnChart data={months.map((m) => ({ key: m.key, label: m.label, value: m.value, year: m.year }))} color={TEAL} name="Bookings by month" tipLabel={(d) => `${d.label} ${d.year}`} format={(v) => String(Math.round(v))} />
          </ChartCard>

          <div className="ad-pair">
            <ChartCard
              id="statuses"
              title="Orders by status"
              sub="Every order"
              table={{ head: ["Status", "Orders"], rows: statuses.map((x) => [x.name, x.value]) }}
              empty={!orders.length && <Empty icon="orders" title="No orders yet">Orders arrive here as soon as Stripe confirms a payment.</Empty>}
            >
              <Donut data={statuses} centerLabel={`order${orders.length === 1 ? "" : "s"}`} />
            </ChartCard>
            <ChartCard
              id="types"
              title="Bookings by event type"
              sub="Every request"
              table={{ head: ["Event type", "Bookings"], rows: types.map((t) => [t.label, t.value]) }}
              empty={!bookings.length && <Empty icon="bookings" title="No booking requests yet">Requests from the site's form land here.</Empty>}
            >
              <HBars data={types} color={TEAL} />
            </ChartCard>
          </div>
        </div>

        <div className="ad-stack">
          <section className="ad-card" aria-labelledby="attn-title" data-attention>
            <div className="ad-card-h">
              <div>
                <h2 id="attn-title">Needs attention</h2>
                <p>New bookings after 24 hours, orders not moving after 7 days</p>
              </div>
              {attn.length > 0 && (
                <span className="ad-count" style={{ marginLeft: "auto" }} data-attention-count>
                  {attn.length}
                </span>
              )}
            </div>
            {attn.length ? (
              <ul className="ad-attn">
                {attn.slice(0, 8).map((a) => (
                  <li key={`${a.kind}${a.id}`}>
                    <a href={a.href} data-attention-item={a.kind}>
                      <span className="ad-attn-icon" style={{ background: a.kind === "booking" ? "#faefcf" : "#fde3da", color: a.kind === "booking" ? "#6e4b00" : "#8f3416" }}>
                        <Icon name={a.kind === "booking" ? "bookings" : "orders"} size={17} />
                      </span>
                      <span style={{ minWidth: 0 }}>
                        <b>{a.name}</b>
                        <small>
                          {a.kind === "booking" ? `Booking, still New` : `Order, still ${statusOf(a.status).name}`}
                          {a.kind === "order" ? `, ${money(a.total, a.currency)}` : a.detail.length ? `, ${a.detail[0]}` : ""}
                        </small>
                      </span>
                      <span className="ad-age">{ago(new Date(Date.now() - a.age).toISOString())}</span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty icon="check" title="All caught up">Nothing is waiting too long.</Empty>
            )}
            {attn.length > 8 && <p className="ad-muted" style={{ marginTop: 8, fontSize: 13 }}>And {attn.length - 8} more.</p>}
          </section>

          <section className="ad-card" aria-labelledby="feed-title" data-feed>
            <div className="ad-card-h">
              <div>
                <h2 id="feed-title">Recent activity</h2>
                <p>Who changed what, newest first</p>
              </div>
            </div>
            {feed.length ? (
              <ul className="ad-feed">
                {feed.map((e) => (
                  <li key={e.key}>
                    <a href={e.href} data-feed-item={e.kind}>
                      <span className="ad-feed-icon">
                        <Icon name={e.kind === "booking" ? "bookings" : "orders"} size={16} />
                      </span>
                      <span style={{ minWidth: 0 }}>
                        <p>
                          <b>{e.name}</b>{" "}
                          {e.from ? (
                            <>
                              moved to <StatusBadge kind={e.kind} status={e.to} />
                            </>
                          ) : (
                            <>{e.kind === "booking" ? "sent a booking request" : "placed an order"}</>
                          )}
                        </p>
                        <small>
                          {ago(e.at)} · {e.who}
                          {e.note ? ` · ${e.note}` : ""}
                        </small>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty icon="clock" title="No activity yet">Status changes by the team show up here.</Empty>
            )}
          </section>
          {!includeDemo && <p className="ad-muted" style={{ fontSize: 12.5, textAlign: "center" }}>Demo data is hidden. Turn on "Include demo data" at the top to count it.</p>}
        </div>
      </div>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-busy="true" role="status" aria-label="Loading the dashboard">
      <div className="ad-kpis">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="ad-card ad-kpi">
            <Skeleton h={12} w="55%" />
            <Skeleton h={30} w="45%" style={{ margin: "14px 0 8px" }} />
            <Skeleton h={10} w="70%" />
          </div>
        ))}
      </div>
      <div className="ad-dash">
        <div className="ad-stack">
          <div className="ad-card">
            <Skeleton h={14} w="40%" />
            <Skeleton h={170} style={{ marginTop: 16 }} />
          </div>
          <div className="ad-card">
            <Skeleton h={14} w="35%" />
            <Skeleton h={150} style={{ marginTop: 16 }} />
          </div>
        </div>
        <div className="ad-stack">
          <div className="ad-card">
            <Skeleton h={14} w="45%" />
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} h={36} style={{ marginTop: 12 }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
