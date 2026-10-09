import { useEffect, useState } from "react";
import { navigate } from "../router.js";
import "./admin.css";
import BookingDetail from "./BookingDetail.jsx";
import BookingsList from "./BookingsList.jsx";
import CalendarScreen from "./CalendarScreen.jsx";
import Dashboard from "./Dashboard.jsx";
import OrderDetail from "./OrderDetail.jsx";
import OrdersList from "./OrdersList.jsx";
import { excludeDemo } from "./format.js";
import { supabase } from "./supabase.js";
import { Bare, DemoProvider, Shell, logo, useDemo } from "./ui.jsx";

// ---------------------------------------------------------------------------
// The staff portal, at /admin.
//
//   /admin                  the dashboard: numbers, what needs attention,
//                           charts, the latest changes
//   /admin/orders           the orders, newest first
//   /admin/orders/<id>      one order: hats, customer, status, notes
//   /admin/bookings         booking requests: a list, or ?view=board
//   /admin/bookings/<id>    one request: contact, event, status, notes
//   /admin/calendar         event dates by month
//
// Sign in is Supabase Auth with email and password. A person who signs in
// but is not in the `staff` table is signed straight back out with the same
// neutral message a wrong password gets, so the page never says which
// accounts exist. Row Level Security enforces the same thing on the server:
// without a staff row, every query returns nothing.
// ---------------------------------------------------------------------------

const NO_ACCESS = "We could not sign you in. Check the email and password, or ask the owner for access.";

export default function AdminApp({ path }) {
  useEffect(() => {
    const prev = document.title;
    document.title = "Staff portal | Tippin' Cowgirl";
    return () => {
      document.title = prev;
    };
  }, []);

  if (!supabase) {
    return (
      <Bare>
        <div className="ad-login">
          <div className="ad-card" style={{ maxWidth: 420 }}>
            <h1 className="ad-h1">Staff portal</h1>
            <p className="ad-muted" style={{ marginTop: 8 }}>
              The portal is not set up on this deployment yet. See docs/portal-setup.md.
            </p>
          </div>
        </div>
      </Bare>
    );
  }
  return (
    <DemoProvider>
      <Gate path={path} />
    </DemoProvider>
  );
}

const UUID = "([0-9a-f-]{36})";

function route(path) {
  let m;
  if ((m = path.match(new RegExp(`^/admin/orders/${UUID}$`, "i")))) return { section: "orders", screen: "order", id: m[1] };
  if (path === "/admin/orders") return { section: "orders", screen: "orders" };
  if ((m = path.match(new RegExp(`^/admin/bookings/${UUID}$`, "i")))) return { section: "bookings", screen: "booking", id: m[1] };
  if (path === "/admin/bookings") return { section: "bookings", screen: "bookings" };
  if (path === "/admin/calendar") return { section: "calendar", screen: "calendar" };
  return { section: "dashboard", screen: "dashboard" };
}

function Gate({ path }) {
  const { includeDemo } = useDemo();
  // undefined while the saved session is being read
  const [session, setSession] = useState(undefined);
  const [staff, setStaff] = useState(null);
  const [message, setMessage] = useState("");
  const [newBookings, setNewBookings] = useState(0);
  const [recount, setRecount] = useState(0);

  // the calendar used to live at /admin/bookings?view=calendar
  useEffect(() => {
    if (path === "/admin/bookings" && new URLSearchParams(window.location.search).get("view") === "calendar") {
      const month = new URLSearchParams(window.location.search).get("month");
      navigate(`/admin/calendar${month ? `?month=${month}` : ""}`, { replace: true });
    }
  }, [path]);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => alive && setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s ?? null));
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Every session is checked against `staff` before anything is shown.
  useEffect(() => {
    if (!session) {
      setStaff(null);
      return;
    }
    let alive = true;
    supabase
      .from("staff")
      .select("email, role")
      .eq("user_id", session.user.id)
      .maybeSingle()
      .then(async ({ data, error }) => {
        if (!alive) return;
        if (error || !data) {
          await supabase.auth.signOut();
          setMessage(NO_ACCESS);
          setStaff(null);
          return;
        }
        setStaff(data);
      });
    return () => {
      alive = false;
    };
  }, [session]);

  // The "new" bookings badge, refreshed on every move around the portal.
  useEffect(() => {
    if (!staff) return undefined;
    let alive = true;
    let q = supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "new");
    if (!includeDemo) q = excludeDemo(q, "email");
    q.then(({ count, error }) => alive && !error && setNewBookings(count || 0));
    return () => {
      alive = false;
    };
  }, [staff, path, recount, includeDemo]);

  if (session === undefined || (session && !staff)) {
    return (
      <Bare>
        <div className="ad-login">
          <p className="ad-muted" role="status">
            Loading
          </p>
        </div>
      </Bare>
    );
  }
  if (!session) return <Login message={message} setMessage={setMessage} />;

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/admin");
  };
  const r = route(path);
  const bump = () => setRecount((n) => n + 1);
  return (
    <Shell staff={staff} onSignOut={signOut} section={r.section} newBookings={newBookings}>
      {r.screen === "order" && <OrderDetail id={r.id} />}
      {r.screen === "orders" && <OrdersList />}
      {r.screen === "booking" && <BookingDetail id={r.id} onChanged={bump} />}
      {r.screen === "bookings" && <BookingsList onChanged={bump} />}
      {r.screen === "calendar" && <CalendarScreen onChanged={bump} />}
      {r.screen === "dashboard" && <Dashboard />}
    </Shell>
  );
}

function Login({ message, setMessage }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setMessage(NO_ACCESS);
  };

  return (
    <Bare>
      <div className="ad-login">
        <form onSubmit={submit} className="ad-card" aria-labelledby="login-title">
          <img src={logo} alt="Tippin' Cowgirl" />
          <h1 id="login-title" className="ad-h1" style={{ textAlign: "center", fontSize: 28 }}>
            Staff portal
          </h1>
          <p className="ad-muted" style={{ textAlign: "center", margin: "4px 0 20px" }}>
            Sign in to see orders and bookings.
          </p>
          <label className="ad-label" htmlFor="admin-email">
            Email
          </label>
          <input id="admin-email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className="ad-input" />
          <label className="ad-label" style={{ marginTop: 14 }} htmlFor="admin-password">
            Password
          </label>
          <input id="admin-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="ad-input" />
          {message && (
            <p role="alert" className="ad-msg-err">
              {message}
            </p>
          )}
          <button type="submit" className="ad-btn ad-btn--coral" disabled={busy} style={{ width: "100%", marginTop: 20 }}>
            {busy ? "Signing in" : "Sign in"}
          </button>
        </form>
      </div>
    </Bare>
  );
}
