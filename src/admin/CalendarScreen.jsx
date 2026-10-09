import { useCallback, useEffect, useMemo, useState } from "react";
import BookingDetail from "./BookingDetail.jsx";
import { BOOKING_STATUSES, addMonths, bookingStatusOf, eventDay, isDemoEmail, localMonth, localYmd, monthName } from "./format.js";
import { supabase } from "./supabase.js";
import { Empty, Icon, PageHead, Panel, Skeleton, StatusBadge, useDemo } from "./ui.jsx";

// Event dates, a month at a time. Each day shows its bookings as chips (name
// and event type) in their status color; a rescheduled booking's proposed
// date shows as a dashed chip. Above the grid, twelve months with a count
// each, so the months with probable bookings stand out. Clicking a chip
// opens the booking in a side panel without leaving the calendar.
//
// On a phone the grid shrinks to dots and the selected day's bookings are
// listed under it. ?month=2026-11 keeps the month across reloads.

const COLS = "id, name, email, event_type, event_date, proposed_date, status";
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_CHIPS = 3;

function readMonth() {
  const m = new URLSearchParams(window.location.search).get("month") || "";
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(m) ? m : localMonth();
}

/** Each booking on its event date, plus a dashed entry on a proposed date. */
function entriesByDay(bookings) {
  const map = {};
  for (const b of bookings) {
    if (b.event_date) (map[b.event_date] ||= []).push({ b, kind: "event", key: `${b.id}e` });
    if (b.proposed_date && b.proposed_date !== b.event_date && b.status !== "declined")
      (map[b.proposed_date] ||= []).push({ b, kind: "proposed", key: `${b.id}p` });
  }
  return map;
}

export default function CalendarScreen({ onChanged }) {
  const { includeDemo } = useDemo();
  const thisMonth = localMonth();
  const today = localYmd();
  const [month, setMonth] = useState(readMonth);
  const [all, setAll] = useState(null);
  const [error, setError] = useState("");
  const [picked, setPicked] = useState(null);
  const [open, setOpen] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    window.history.replaceState(null, "", month === thisMonth ? "/admin/calendar" : `/admin/calendar?month=${month}`);
  }, [month, thisMonth]);

  useEffect(() => {
    let alive = true;
    supabase
      .from("bookings")
      .select(COLS)
      .order("event_date", { ascending: true })
      .limit(3000)
      .then(({ data, error: err }) => {
        if (!alive) return;
        if (err) setError("The calendar could not be loaded. Try again in a moment.");
        else setAll(data);
      });
    return () => {
      alive = false;
    };
  }, [tick]);

  const bookings = useMemo(() => (all || []).filter((b) => includeDemo || !isDemoEmail(b.email)), [all, includeDemo]);
  const byDay = useMemo(() => entriesByDay(bookings), [bookings]);

  // the strip: twelve months from this one, moved along if the shown month is outside them
  const stripStart = month < thisMonth ? month : month > addMonths(thisMonth, 11) ? addMonths(month, -11) : thisMonth;
  const strip = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => addMonths(stripStart, i));
    return months.map((m) => {
      const ids = new Set();
      for (const b of bookings) {
        if (b.status === "declined") continue;
        if ((b.event_date || "").startsWith(m) || (b.proposed_date || "").startsWith(m)) ids.add(b.id);
      }
      return { m, n: ids.size };
    });
  }, [bookings, stripStart]);

  const go = (m) => {
    setMonth(m);
    setPicked(null);
  };
  const changed = useCallback(() => {
    setTick((n) => n + 1);
    onChanged?.();
  }, [onChanged]);

  const [y, mo] = month.split("-").map(Number);
  const days = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const lead = new Date(Date.UTC(y, mo - 1, 1)).getUTCDay();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  while (cells.length % 7) cells.push(null);
  const daySel = picked || (month === thisMonth ? today : `${month}-01`);
  const monthCount = Object.entries(byDay).filter(([d]) => d.startsWith(month)).reduce((n, [, l]) => n + l.length, 0);

  return (
    <>
      <PageHead
        title="Calendar"
        sub="Events by the day they happen. Dashed chips are proposed new dates."
        actions={
          <div className="ad-cal-nav">
            <button type="button" className="ad-iconbtn" onClick={() => go(addMonths(month, -1))} aria-label="Previous month" data-cal="prev">
              <Icon name="left" size={18} />
            </button>
            <h2 className="ad-cal-title" data-cal="title" aria-live="polite">
              {monthName(month)}
            </h2>
            <button type="button" className="ad-iconbtn" onClick={() => go(addMonths(month, 1))} aria-label="Next month" data-cal="next">
              <Icon name="right" size={18} />
            </button>
            <button
              type="button"
              className="ad-btn ad-btn--ghost ad-btn--sm"
              onClick={() => {
                go(thisMonth);
                setPicked(today);
              }}
              data-cal="today"
            >
              Today
            </button>
          </div>
        }
      />

      <div className="ad-strip" role="group" aria-label="Bookings per month">
        {strip.map(({ m, n }, i) => (
          <button
            key={m}
            type="button"
            data-month={m}
            data-has={n > 0}
            aria-current={m === month}
            aria-label={`${monthName(m)}: ${n} booking${n === 1 ? "" : "s"}`}
            onClick={() => go(m)}
          >
            <span className="ad-strip-m">{monthName(m, { month: "short" })}</span>
            <span className="ad-strip-y">{i === 0 || m.endsWith("-01") ? m.slice(0, 4) : " "}</span>
            <span className="ad-strip-n" data-count>
              {n}
            </span>
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="ad-msg-err">
          {error}
        </p>
      )}

      <section className="ad-card ad-cal" aria-label={`Bookings in ${monthName(month)}`} aria-busy={!all}>
        <div className="ad-cal-grid">
          {WEEKDAYS.map((d) => (
            <div key={d} className="ad-cal-wd" aria-hidden>
              {d}
            </div>
          ))}
          {cells.map((day, i) => {
            if (!day) return <div key={`x${i}`} className="ad-day" data-out="true" aria-hidden />;
            const list = byDay[day] || [];
            const wd = i % 7;
            return (
              <div
                key={day}
                className="ad-day"
                data-day={day}
                data-today={day === today}
                data-weekend={wd === 0 || wd === 6}
                data-selected={daySel === day}
                onClick={() => setPicked(day)}
              >
                <button
                  type="button"
                  className="ad-day-n"
                  aria-pressed={daySel === day}
                  aria-label={`${eventDay(day, { weekday: "long", month: "long", day: "numeric" })}: ${list.length ? `${list.length} booking${list.length === 1 ? "" : "s"}` : "nothing"}`}
                >
                  {Number(day.slice(8))}
                </button>
                {!all ? (
                  <Skeleton h={8} w="70%" />
                ) : (
                  <>
                    <span className="ad-day-dots" aria-hidden>
                      {list.slice(0, 4).map(({ b, kind, key }) => (
                        <span key={key} className="ad-dot" data-dot={b.status} data-proposed={kind === "proposed"} style={{ background: bookingStatusOf(b.status).color, "--c": bookingStatusOf(b.status).color }} />
                      ))}
                      {list.length > 4 && <span className="ad-day-more">+{list.length - 4}</span>}
                    </span>
                    {list.slice(0, MAX_CHIPS).map(({ b, kind, key }) => {
                      const s = bookingStatusOf(b.status);
                      return (
                        <button
                          key={key}
                          type="button"
                          className="ad-chipcal"
                          data-chip={b.id}
                          data-kind={kind}
                          data-status={b.status}
                          style={{ "--c": s.color, "--bg": s.bg, "--ink": s.ink }}
                          title={`${b.name}${b.event_type ? `, ${b.event_type}` : ""} (${kind === "proposed" ? "proposed date" : s.name})`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpen(b.id);
                          }}
                        >
                          {kind === "proposed" ? "Proposed: " : ""}
                          {b.name}
                          {b.event_type && <small>{b.event_type}</small>}
                        </button>
                      );
                    })}
                    {list.length > MAX_CHIPS && <span className="ad-day-more ad-chipcal-more">+{list.length - MAX_CHIPS} more</span>}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div className="ad-legend" style={{ margin: "12px 2px 0" }} aria-label="Status colors">
        {BOOKING_STATUSES.map((s) => (
          <span key={s.id}>
            <i style={{ background: s.color }} aria-hidden />
            {s.name}
          </span>
        ))}
        <span>
          <i style={{ background: "none", border: "1.5px dashed #77604e" }} aria-hidden />
          Proposed date
        </span>
        <span style={{ marginLeft: "auto" }}>{monthCount ? `${monthCount} on the calendar this month` : ""}</span>
      </div>

      <section className="ad-agenda" aria-labelledby="agenda-title">
        <h2 id="agenda-title" className="ad-label" data-cal="picked">
          {eventDay(daySel, { weekday: "long", month: "long", day: "numeric" })}
        </h2>
        {(byDay[daySel] || []).length ? (
          <ul className="ad-rows">
            {(byDay[daySel] || []).map(({ b, kind, key }) => (
              <li key={key}>
                <button type="button" className="ad-card ad-agenda-item" style={{ "--c": bookingStatusOf(b.status).color }} data-kind={kind} data-agenda={b.id} onClick={() => setOpen(b.id)}>
                  <i aria-hidden />
                  <span style={{ minWidth: 0 }}>
                    <b style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.name}</b>
                    <span className="ad-row-meta" style={{ display: "block" }}>
                      {kind === "proposed" ? "Proposed new date" : b.event_type || "Event"}
                    </span>
                  </span>
                  <StatusBadge kind="booking" status={b.status} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="ad-card">
            <Empty icon="calendar" title="Nothing on this day">Tap another day, or move to a highlighted month above.</Empty>
          </div>
        )}
      </section>

      {open && (
        <Panel title="Booking" onClose={() => setOpen(null)}>
          <BookingDetail id={open} panel onChanged={changed} />
        </Panel>
      )}
    </>
  );
}
