import { useEffect, useState } from "react";
import { STATUSES, money, searchTerm, shortDate } from "./format.js";
import { supabase } from "./supabase.js";
import { StatusBadge, ui } from "./ui.jsx";

// The orders, newest first: filter by status, search by name or email.
// Row Level Security decides what comes back; this only asks.

const PAGE = 50;

export default function OrdersList() {
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const [rows, setRows] = useState([]);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // wait for a pause in typing before searching
  useEffect(() => {
    const t = setTimeout(() => setTerm(searchTerm(query)), 300);
    return () => clearTimeout(t);
  }, [query]);

  const load = async (offset = 0) => {
    setLoading(true);
    setError("");
    let q = supabase
      .from("orders")
      .select("id, created_at, customer_name, customer_email, status, total, currency, hat_count")
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE - 1);
    if (status !== "all") q = q.eq("status", status);
    // PostgREST spells the ilike wildcard "*"; searchTerm() strips it, and
    // every other separator, from what was typed
    if (term) q = q.or(`customer_name.ilike.*${term}*,customer_email.ilike.*${term}*`);
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
  }, [status, term]);

  return (
    <>
      <h1 style={{ ...ui.h1, margin: "8px 0 14px" }}>Orders</h1>

      <label htmlFor="order-search" style={ui.label}>
        Search
      </label>
      <input
        id="order-search"
        type="search"
        placeholder="Name or email"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={ui.input}
      />

      <div role="group" aria-label="Filter by status" style={{ display: "flex", gap: 8, overflowX: "auto", padding: "14px 0 6px", margin: "0 -16px", paddingLeft: 16, paddingRight: 16 }}>
        {[{ id: "all", name: "All" }, ...STATUSES].map((s) => (
          <button key={s.id} type="button" aria-pressed={status === s.id} data-filter={s.id} onClick={() => setStatus(s.id)} style={ui.chip(status === s.id)}>
            {s.name}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" style={ui.error}>
          {error}
        </p>
      )}

      <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0, display: "grid", gap: 10 }} aria-busy={loading}>
        {rows.map((o) => (
          <li key={o.id}>
            <a
              href={`/admin/orders/${o.id}`}
              data-order={o.id}
              style={{
                ...ui.card,
                boxShadow: "0 3px 0 var(--ink)",
                padding: "12px 14px",
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: "4px 12px",
                color: "var(--ink)",
                textDecoration: "none",
              }}
            >
              <span style={{ fontWeight: 800, fontSize: 15.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {o.customer_name || "No name"}
              </span>
              <span style={{ fontWeight: 800, fontSize: 15.5, textAlign: "right" }}>{money(o.total, o.currency)}</span>
              <span style={{ fontSize: 13, color: "#7a6553", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {o.customer_email || ""}
              </span>
              <span style={{ fontSize: 13, color: "#7a6553", textAlign: "right", whiteSpace: "nowrap" }}>
                {o.hat_count} {o.hat_count === 1 ? "hat" : "hats"}
              </span>
              <span>
                <StatusBadge status={o.status} />
              </span>
              <span style={{ fontSize: 13, color: "#7a6553", textAlign: "right" }}>{shortDate(o.created_at)}</span>
            </a>
          </li>
        ))}
      </ul>

      {!loading && !error && rows.length === 0 && (
        <p style={{ ...ui.muted, textAlign: "center", marginTop: 30 }}>{term || status !== "all" ? "No orders match." : "No orders yet."}</p>
      )}
      {loading && (
        <p style={{ ...ui.muted, textAlign: "center", marginTop: 20 }} role="status">
          Loading
        </p>
      )}
      {more && !loading && (
        <button type="button" className="tc-btn tc-btn--ghost" style={{ width: "100%", marginTop: 16 }} onClick={() => load(rows.length)}>
          Show more
        </button>
      )}
    </>
  );
}
