import { useEffect, useRef, useState } from "react";
import HatStack from "../shop/HatStack.jsx";
import { STATUSES, excludeDemo, money, searchTerm, shortDate } from "./format.js";
import { supabase } from "./supabase.js";
import { Empty, Icon, PageHead, Skeleton, StatusBadge, useDemo } from "./ui.jsx";

// The orders, newest first: filter by status (with counts), search by name
// or email, a small drawing of the first hat on each row. Row Level
// Security decides what comes back; this only asks.

const PAGE = 50;

/** Search and the demo switch, shared by the list and its counts. */
function scoped(q, { term, includeDemo }) {
  // PostgREST spells the ilike wildcard "*"; searchTerm() strips it, and
  // every other separator, from what was typed
  if (term) q = q.or(`customer_name.ilike.*${term}*,customer_email.ilike.*${term}*`);
  if (!includeDemo) q = excludeDemo(q, "customer_email");
  return q;
}

export default function OrdersList() {
  const { includeDemo } = useDemo();
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState(null);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // wait for a pause in typing before searching
  useEffect(() => {
    const t = setTimeout(() => setTerm(searchTerm(query)), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    let alive = true;
    scoped(supabase.from("orders").select("status"), { term, includeDemo })
      .limit(5000)
      .then(({ data, error: err }) => {
        if (!alive || err) return;
        const c = { all: data.length };
        for (const r of data) c[r.status] = (c[r.status] || 0) + 1;
        setCounts(c);
      });
    return () => {
      alive = false;
    };
  }, [term, includeDemo]);

  const load = async (offset = 0) => {
    setLoading(true);
    setError("");
    let q = scoped(supabase.from("orders").select("id, created_at, customer_name, customer_email, status, total, currency, hat_count, hats"), { term, includeDemo })
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE - 1);
    if (status !== "all") q = q.eq("status", status);
    const { data, error: err } = await q;
    setLoading(false);
    if (err) {
      setError("The orders could not be loaded. Try again in a moment.");
      return;
    }
    setRows((prev) => (offset ? [...prev, ...data] : data));
    setMore(data.length === PAGE);
  };

  useEffect(() => {
    load(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, term, includeDemo]);

  return (
    <>
      <PageHead title="Orders" sub="Every paid order, newest first." />

      <div className="ad-toolbar">
        <label className="ad-search" style={{ maxWidth: 520 }}>
          <span className="ad-sr">Search by name or email</span>
          <Icon name="search" size={18} />
          <input id="order-search" type="search" className="ad-input" placeholder="Search name or email" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <div className="ad-chips" role="group" aria-label="Filter by status">
          {[{ id: "all", name: "All" }, ...STATUSES].map((s) => (
            <button key={s.id} type="button" className="ad-fchip" aria-pressed={status === s.id} data-filter={s.id} onClick={() => setStatus(s.id)}>
              {s.color && <span className="ad-dot" style={{ background: s.color }} aria-hidden />}
              {s.name}
              <span className="ad-fchip-n" data-count>
                {counts ? counts[s.id] || 0 : "·"}
              </span>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p role="alert" className="ad-msg-err">
          {error}
        </p>
      )}

      {loading && !rows.length ? (
        <div className="ad-rows" role="status" aria-label="Loading">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} h={92} r={16} />
          ))}
        </div>
      ) : (
        <ul className="ad-rows" aria-busy={loading} style={{ opacity: loading ? 0.6 : 1 }}>
          {rows.map((o) => (
            <li key={o.id}>
              <OrderRow o={o} />
            </li>
          ))}
        </ul>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="ad-card">
          {term || status !== "all" ? (
            <Empty icon="search" title="No orders match">Try another name, or another status.</Empty>
          ) : (
            <Empty icon="orders" title="No orders yet">Paid orders arrive here as soon as Stripe confirms them.</Empty>
          )}
        </div>
      )}
      {more && !loading && (
        <button type="button" className="ad-btn ad-btn--ghost" style={{ width: "100%", marginTop: 16 }} onClick={() => load(rows.length)}>
          Show more
        </button>
      )}
    </>
  );
}

function OrderRow({ o }) {
  const hat = (Array.isArray(o.hats) ? o.hats : []).find((h) => h?.config);
  return (
    <a href={`/admin/orders/${o.id}`} data-order={o.id} className="ad-card ad-row ad-row--hat">
      <span className="ad-row-thumb" aria-hidden>
        {hat ? <LazyHat config={hat.config} /> : <span style={{ display: "grid", placeItems: "center", height: "100%", color: "#c9b293" }}><Icon name="hat" size={30} /></span>}
      </span>
      <span className="ad-row-title">{o.customer_name || "No name"}</span>
      <span className="ad-row-right" style={{ fontWeight: 900, fontSize: 15.5 }}>
        {money(o.total, o.currency)}
      </span>
      <span className="ad-row-meta">{o.customer_email || ""}</span>
      <span className="ad-row-right ad-row-meta">
        {o.hat_count} {o.hat_count === 1 ? "hat" : "hats"}
      </span>
      <span>
        <StatusBadge status={o.status} />
      </span>
      <span className="ad-row-right ad-row-meta">{shortDate(o.created_at)}</span>
    </a>
  );
}

/** The hat drawing, mounted only once its row comes near the screen. */
function LazyHat({ config }) {
  const ref = useRef(null);
  const [show, setShow] = useState(typeof IntersectionObserver === "undefined");
  useEffect(() => {
    if (show || !ref.current) return undefined;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setShow(true), { rootMargin: "200px" });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [show]);
  return (
    <span ref={ref} style={{ position: "absolute", inset: 0 }} data-hat-preview>
      {show && <HatStack config={config} alt="" />}
    </span>
  );
}
