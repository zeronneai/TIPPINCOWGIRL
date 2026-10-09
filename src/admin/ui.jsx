import { createContext, useContext, useEffect, useRef, useState } from "react";
import logo from "/logo.png";
import { bookingStatusOf, statusOf } from "./format.js";

// The portal's frame and shared pieces. Styles live in admin.css (the
// /admin chunk only); `ui` keeps a few inline styles the detail screens use.
//
// Desktop (900px and up): a brown sidebar with the logo and the sections,
// and a top bar with the demo switch and who is signed in. Phones and
// tablets: a compact top bar and a tab bar at the bottom.

export const ui = {
  label: { display: "block", fontSize: 11.5, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "#5b4535", marginBottom: 6 },
  muted: { fontSize: 14, color: "#77604e", margin: 0, lineHeight: 1.5 },
};

// ---- the "Include demo data" switch -------------------------------------------------
// Off by default. Remembered in this browser only; a blocked or private
// storage simply means it starts off again.
const DEMO_KEY = "tc-admin-include-demo";
const DemoContext = createContext({ includeDemo: false, setIncludeDemo: () => {} });

function readDemo() {
  try {
    return window.localStorage.getItem(DEMO_KEY) === "1";
  } catch {
    return false;
  }
}

export function DemoProvider({ children }) {
  const [includeDemo, set] = useState(readDemo);
  const setIncludeDemo = (v) => {
    set(v);
    try {
      window.localStorage.setItem(DEMO_KEY, v ? "1" : "0");
    } catch {
      /* storage blocked: it still works for this visit */
    }
  };
  return <DemoContext.Provider value={{ includeDemo, setIncludeDemo }}>{children}</DemoContext.Provider>;
}
export const useDemo = () => useContext(DemoContext);

function DemoSwitch() {
  const { includeDemo, setIncludeDemo } = useDemo();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={includeDemo}
      aria-label="Include demo data"
      className="ad-switch"
      data-testid="demo-toggle"
      onClick={() => setIncludeDemo(!includeDemo)}
      title="Count orders and bookings whose email ends in @demo.tippin"
    >
      <span className="ad-switch-track" aria-hidden />
      <span className="ad-switch-long">Include demo data</span>
      <span className="ad-switch-short">Demo</span>
    </button>
  );
}

// ---- icons (hand drawn, 1.8px strokes, currentColor) --------------------------------------
const P = {
  dashboard: "M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z",
  orders: "M5 8h14l-1.2 11.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8zM9 8V6.5a3 3 0 0 1 6 0V8",
  bookings: "M8 4h8v3H8zM6 5.5H5a1 1 0 0 0-1 1V20a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V6.5a1 1 0 0 0-1-1h-1M8 12h8M8 16h5",
  calendar: "M4 6.5a1.5 1.5 0 0 1 1.5-1.5h13A1.5 1.5 0 0 1 20 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19zM4 10h16M8.5 3v4M15.5 3v4",
  settings:
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 13.5l1.3 1-1.8 3.1-1.6-.6a7 7 0 0 1-2 1.2L15 20h-3.6l-.3-1.8a7 7 0 0 1-2-1.2l-1.6.6-1.8-3.1 1.3-1a7 7 0 0 1 0-2.4l-1.3-1 1.8-3.1 1.6.6a7 7 0 0 1 2-1.2L11.4 4H15l.3 1.8a7 7 0 0 1 2 1.2l1.6-.6 1.8 3.1-1.3 1a7 7 0 0 1 0 2.4z",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4",
  left: "M15 5l-7 7 7 7",
  right: "M9 5l7 7-7 7",
  close: "M6 6l12 12M18 6L6 18",
  phone: "M5 4h3.5l1.5 4-2 1.5a11 11 0 0 0 6.5 6.5l1.5-2 4 1.5V19a1.5 1.5 0 0 1-1.6 1.5A16 16 0 0 1 3.5 5.6 1.5 1.5 0 0 1 5 4z",
  mail: "M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5zM4.5 6.5l7.5 6 7.5-6",
  copy: "M9 9h10v11H9zM5 15V4h10",
  check: "M5 12.5l4.5 4.5L19 7.5",
  alert: "M12 4l9 16H3zM12 10v4.5M12 17.5v.5",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7.5V12l3 2",
  hat: "M3 15.5c2 1.6 5.4 2.5 9 2.5s7-.9 9-2.5M7 15.2c0-5 1.8-8.7 5-8.7s5 3.7 5 8.7M7.4 12.4h9.2",
  money: "M12 3v18M16.5 7.5c-.8-1.3-2.5-2-4.5-2-2.5 0-4.2 1.3-4.2 3.1 0 4.3 8.7 2.3 8.7 6.6 0 1.9-1.9 3.3-4.5 3.3-2.1 0-3.9-.8-4.8-2.2",
  spark: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18",
  inbox: "M4 13l2.5-7.5a1 1 0 0 1 1-.5h9a1 1 0 0 1 1 .5L20 13v5.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5zM4 13h4.5l1 2h5l1-2H20",
  move: "M5 12h14M14 7l5 5-5 5",
  out: "M14 5h4.5A1.5 1.5 0 0 1 20 6.5v11a1.5 1.5 0 0 1-1.5 1.5H14M10 16l-4-4 4-4M6 12h9",
};

export function Icon({ name, size = 20, ...rest }) {
  if (name === "whatsapp")
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...rest}>
        <path
          fill="currentColor"
          d="M12 2.2A9.7 9.7 0 0 0 3.6 16.8L2.3 21.7l5-1.3A9.7 9.7 0 1 0 12 2.2zm0 17.7a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 19.9zm4.4-6c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8 1c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 0 0-.7.3 2.8 2.8 0 0 0-.9 2.1 5 5 0 0 0 1 2.6 11.2 11.2 0 0 0 4.3 3.8c1.6.7 2.2.7 3 .6a2.6 2.6 0 0 0 1.7-1.2 2.1 2.1 0 0 0 .2-1.2c-.1-.1-.2-.2-.4-.3z"
        />
      </svg>
    );
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <path d={P[name] || P.spark} />
    </svg>
  );
}

// ---- badges, skeletons, empty states ----------------------------------------------------

export function StatusBadge({ status, kind = "order" }) {
  const s = kind === "booking" ? bookingStatusOf(status) : statusOf(status);
  return (
    <span className="ad-badge" data-status={s.id} style={{ background: s.bg, color: s.ink }}>
      <span className="ad-dot" style={{ background: s.color }} aria-hidden />
      {s.name}
    </span>
  );
}

export function Skeleton({ h = 16, w = "100%", r, style }) {
  return <div className="ad-skel" aria-hidden style={{ height: h, width: w, borderRadius: r, ...style }} />;
}

export function Empty({ icon = "hat", title, children }) {
  return (
    <div className="ad-empty" data-empty>
      <Icon name={icon} size={40} />
      <b>{title}</b>
      {children && <p>{children}</p>}
    </div>
  );
}

export function PageHead({ eyebrow = "Tippin' Cowgirl", title, sub, actions, watermark = false }) {
  return (
    <header className="ad-head">
      <div style={{ minWidth: 0 }}>
        <p className="ad-eyebrow">{eyebrow}</p>
        <h1 className="ad-h1">{title}</h1>
        {sub && <p className="ad-sub">{sub}</p>}
      </div>
      {actions && <div className="ad-head-actions">{actions}</div>}
      {watermark && <img className="ad-watermark" src={logo} alt="" />}
    </header>
  );
}

// ---- a panel that slides in from the right (full screen on phones) --------------------------
export function Panel({ title, onClose, children }) {
  const ref = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const before = document.activeElement;
    ref.current?.focus();
    const onKey = (e) => e.key === "Escape" && close.current();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      before?.focus?.();
    };
  }, []);
  return (
    <>
      <div className="ad-scrim" onClick={onClose} aria-hidden />
      <div className="ad-panel" role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1} data-panel>
        <div className="ad-panel-bar">
          <b style={{ fontSize: 14.5, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</b>
          <button type="button" className="ad-iconbtn" onClick={onClose} aria-label="Close" style={{ marginLeft: "auto" }} data-panel-close>
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="ad-panel-in">{children}</div>
      </div>
    </>
  );
}

// ---- the frame --------------------------------------------------------------------------------
const SECTIONS = [
  { id: "dashboard", href: "/admin", label: "Dashboard", icon: "dashboard" },
  { id: "orders", href: "/admin/orders", label: "Orders", icon: "orders" },
  { id: "bookings", href: "/admin/bookings", label: "Bookings", icon: "bookings" },
  { id: "calendar", href: "/admin/calendar", label: "Calendar", icon: "calendar" },
];

function Account({ staff, onSignOut }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const key = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  return (
    <div className="ad-account" ref={ref}>
      <button type="button" className="ad-avatar" aria-expanded={open} aria-label="Account" onClick={() => setOpen(!open)} data-testid="account">
        {(staff.email || "?").charAt(0)}
      </button>
      {open && (
        <div className="ad-menu" role="menu">
          <b>{staff.email}</b>
          <small>{staff.role}</small>
          <button type="button" className="ad-btn ad-btn--ghost" style={{ width: "100%" }} onClick={onSignOut} role="menuitem">
            <Icon name="out" size={18} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function Shell({ staff, onSignOut, section, newBookings = 0, children }) {
  return (
    <div className="ad-root">
      <aside className="ad-side" aria-label="Portal">
        <a href="/admin" className="ad-brand">
          <img src={logo} alt="" />
          <span>
            <span className="ad-brand-name">Tippin' Cowgirl</span>
            <span className="ad-brand-sub">Staff portal</span>
          </span>
        </a>
        <div className="ad-stitch" aria-hidden />
        <div className="ad-nav-label">Menu</div>
        <nav className="ad-nav" aria-label="Sections">
          {SECTIONS.map((s) => (
            <a key={s.id} href={s.href} aria-current={section === s.id ? "page" : undefined} data-section={s.id}>
              <Icon name={s.icon} />
              {s.label}
              {s.id === "bookings" && newBookings > 0 && (
                <span className="ad-count" data-testid="new-bookings-badge" aria-label={`${newBookings} new`}>
                  {newBookings}
                </span>
              )}
            </a>
          ))}
          <span className="ad-nav-off" aria-disabled="true" data-section="settings">
            <Icon name="settings" />
            Settings
            <span className="ad-soon">Soon</span>
          </span>
        </nav>
        <p className="ad-side-foot">El Paso, TX</p>
      </aside>

      <div className="ad-body">
        <div className="ad-top">
          <div className="ad-top-in">
            <a href="/admin" className="ad-top-brand">
              <img src={logo} alt="" />
              <span>
                Tippin' <em>Staff</em>
              </span>
            </a>
            <div className="ad-top-right">
              <DemoSwitch />
              <div className="ad-who">
                <b>{staff.email}</b>
                <small>{staff.role}</small>
              </div>
              <button type="button" className="ad-btn ad-btn--ghost ad-btn--sm ad-signout" onClick={onSignOut} data-testid="sign-out">
                <Icon name="out" size={17} /> Sign out
              </button>
              <Account staff={staff} onSignOut={onSignOut} />
            </div>
          </div>
        </div>
        <main className="ad-main">{children}</main>
      </div>

      <nav className="ad-tabs" aria-label="Sections">
        {SECTIONS.map((s) => (
          <a key={s.id} href={s.href} aria-current={section === s.id ? "page" : undefined} data-tab={s.id}>
            <Icon name={s.icon} size={22} />
            {s.label}
            {s.id === "bookings" && newBookings > 0 && (
              <span className="ad-tab-badge" data-testid="new-bookings-badge-tab">
                {newBookings}
              </span>
            )}
          </a>
        ))}
      </nav>
    </div>
  );
}

/** The frame before sign in: just the cream page. */
export function Bare({ children }) {
  return <div className="ad-root">{children}</div>;
}

export { logo };
