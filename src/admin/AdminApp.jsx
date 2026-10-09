import { useEffect, useState } from "react";
import { navigate } from "../router.js";
import { supabase } from "./supabase.js";
import OrdersList from "./OrdersList.jsx";
import OrderDetail from "./OrderDetail.jsx";
import { Shell, ui } from "./ui.jsx";

// ---------------------------------------------------------------------------
// The staff portal, at /admin. Phase 1: orders.
//
//   /admin                  the orders, newest first
//   /admin/orders/<id>      one order: hats, customer, status, notes
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
      <Shell>
        <div style={ui.card}>
          <h1 style={ui.h1}>Staff portal</h1>
          <p style={ui.muted}>The portal is not set up on this deployment yet. See docs/portal-setup.md.</p>
        </div>
      </Shell>
    );
  }
  return <Gate path={path} />;
}

function Gate({ path }) {
  // undefined while the saved session is being read
  const [session, setSession] = useState(undefined);
  const [staff, setStaff] = useState(null);
  const [message, setMessage] = useState("");

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

  if (session === undefined || (session && !staff)) {
    return (
      <Shell>
        <p style={{ ...ui.muted, textAlign: "center", marginTop: 60 }} role="status">
          Loading
        </p>
      </Shell>
    );
  }
  if (!session) return <Login message={message} setMessage={setMessage} />;

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/admin");
  };
  const detail = path.match(/^\/admin\/orders\/([0-9a-f-]{36})$/i);
  return (
    <Shell user={staff.email} onSignOut={signOut}>
      {detail ? <OrderDetail id={detail[1]} /> : <OrdersList />}
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
    <Shell>
      <form onSubmit={submit} style={{ ...ui.card, maxWidth: 420, margin: "40px auto 0" }} aria-labelledby="login-title">
        <h1 id="login-title" style={ui.h1}>
          Staff portal
        </h1>
        <p style={{ ...ui.muted, margin: "0 0 18px" }}>Sign in to see and update orders.</p>
        <label style={ui.label} htmlFor="admin-email">
          Email
        </label>
        <input id="admin-email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} style={ui.input} />
        <label style={{ ...ui.label, marginTop: 14 }} htmlFor="admin-password">
          Password
        </label>
        <input
          id="admin-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={ui.input}
        />
        {message && (
          <p role="alert" style={ui.error}>
            {message}
          </p>
        )}
        <button type="submit" className="tc-btn" disabled={busy} style={{ width: "100%", marginTop: 18 }}>
          {busy ? "Signing in" : "Sign in"}
        </button>
      </form>
    </Shell>
  );
}
