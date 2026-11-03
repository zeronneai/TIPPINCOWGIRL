import { useCallback, useEffect, useRef, useState } from "react";
import {
  CAPTION_KIND,
  OVERLAY_STYLES,
  POSITIONS,
  POST_STATUS,
  burnText,
  dayLabel,
  defaultDay,
  drawOverlay,
  firstLine,
  monthGrid,
  nextDays,
  shiftMonth,
  takenDays,
  todayTz,
  whenLabel,
  ymdTz,
} from "./content.js";
import { supabase } from "./supabase.js";
import { Empty, Icon, PageHead, Skeleton } from "./ui.jsx";

// /admin/content: approve the social media posts Purple Roots prepares in
// Roots Engine. Each video comes with copy options written from what is said
// in it, on screen text ideas and a suggested cover. The staff picks or edits
// the copy, optionally adds text on the video, picks any day and approves.
// Everything goes through api/content.js (staff checked on the server).

const NET = { instagram: "Instagram", tiktok: "TikTok", facebook: "Facebook", youtube: "YouTube" };
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

async function api(body) {
  const { data: s } = await supabase.auth.getSession();
  const headers = { Authorization: `Bearer ${s.session?.access_token || ""}` };
  const r = await fetch("/api/content", body ? { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(body) } : { headers });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, ...j };
}

export default function ContentScreen() {
  const [state, setState] = useState({ loading: true, data: null, error: "", setup: false });
  const [month, setMonth] = useState(() => todayTz().slice(0, 7));
  const [note, setNote] = useState("");
  const drafts = useRef({});

  const load = useCallback(async () => {
    const r = await api().catch(() => ({ ok: false, error: "Could not load the posts. Check the connection." }));
    if (!r.ok) setState({ loading: false, data: null, error: r.error || "Could not load the posts.", setup: !!r.setup });
    else setState({ loading: false, data: r, error: "", setup: false });
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  // while a video is being prepared, check again every 20 seconds
  const busy = state.data && (state.data.items.some((i) => i.status === "processing") || state.data.folders?.checking);
  useEffect(() => {
    if (!busy) return undefined;
    const t = setTimeout(load, 20_000);
    return () => clearTimeout(t);
  }, [busy, state.data, load]);

  const flash = (msg) => {
    setNote(msg);
    setTimeout(() => setNote(""), 3500);
  };
  const act = async (body, ok) => {
    const r = await api(body);
    if (!r.ok) {
      flash(r.error || "Could not save.");
      return false;
    }
    if (ok) flash(ok);
    await load();
    return true;
  };

  const d = state.data;
  const items = d?.items || [];
  const by = (s) => items.filter((i) => i.status === s);
  const pending = by("pending");
  const approved = by("approved");
  const processing = by("processing");
  const posted = by("scheduled").filter((i) => i.post).sort((a, b) => b.post.at.localeCompare(a.post.at));
  const checking = d?.folders?.checking;

  return (
    <>
      <PageHead
        title="Content"
        sub="Your next posts, ready to approve. Pick the copy, the day, and you're done."
        actions={
          d ? (
            <button type="button" className="ad-btn ad-btn--ghost ad-btn--sm" disabled={checking} onClick={() => act({ action: "refresh" }, "Checking the folder. New videos show up here in a few minutes.")}>
              {checking ? "Checking for new videos…" : "Check for new videos"}
            </button>
          ) : null
        }
      />
      {note && (
        <p className="ad-msg-ok ad-cn-note" role="status">
          {note}
        </p>
      )}

      {state.error ? (
        <div className="ad-card">
          <Empty icon={state.setup ? "settings" : "alert"} title={state.setup ? "Content approval is not connected yet" : "Could not load the posts"}>
            {state.setup ? "Your agency needs to connect it once. Nothing to do on your side." : state.error}
          </Empty>
        </div>
      ) : !d ? (
        <div className="ad-card">
          <Skeleton h={18} w="40%" />
          <Skeleton h={220} style={{ marginTop: 14 }} />
        </div>
      ) : (
        <>
          <p className="ad-muted ad-cn-status">
            <span className="ad-cn-dot" />
            Prepared by Purple Roots Agency{d.folders?.lastChecked ? ` · videos checked ${whenLabel(d.folders.lastChecked)}` : ""}
          </p>
          {processing.length > 0 && (
            <div className="ad-card ad-cn-proc">
              {processing.length} new video{processing.length > 1 ? "s are" : " is"} being prepared. {processing.length > 1 ? "They" : "It"} will show up here in a few minutes.
            </div>
          )}

          <section className="ad-cn-sec">
            <h2 className="ad-cn-h">
              Waiting for your approval {pending.length > 0 && <span className="ad-count">{pending.length}</span>}
            </h2>
            {pending.length ? (
              pending.map((i) => <ApprovalCard key={i.id} item={i} items={items} drafts={drafts} flash={flash} reload={load} />)
            ) : (
              <div className="ad-card">
                <Empty icon="check" title="You're all caught up">
                  New videos show up here when the team uploads them.
                </Empty>
              </div>
            )}
          </section>

          <Calendar month={month} setMonth={setMonth} approved={approved} posted={posted} />

          <section className="ad-cn-sec">
            <h2 className="ad-cn-h">Approved · ready to post {approved.length > 0 && <span className="ad-count">{approved.length}</span>}</h2>
            {approved.length ? (
              <ul className="ad-cn-q">
                {approved.map((i, k) => (
                  <QueueRow key={i.id} i={i} k={k} items={items} act={act} flash={flash} />
                ))}
              </ul>
            ) : (
              <p className="ad-muted">Nothing approved yet.</p>
            )}
          </section>

          {posted.length > 0 && (
            <section className="ad-cn-sec">
              <h2 className="ad-cn-h">Scheduled and posted</h2>
              <ul className="ad-cn-q">
                {posted.slice(0, 20).map((i) => (
                  <li key={i.id}>
                    <Thumb i={i} />
                    <span className="ad-cn-qb">
                      <small>
                        {POST_STATUS[i.post.status] || "Scheduled"} · {whenLabel(i.post.at)}
                      </small>
                      <em>{firstLine(i.caption)}</em>
                    </span>
                    <span className="ad-cn-qa">
                      {(i.post.links || []).map((l) => (
                        <a key={l.url} className="ad-linkbtn" href={l.url} target="_blank" rel="noopener noreferrer">
                          See on {NET[l.platform] || l.platform}
                        </a>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </>
  );
}

function Thumb({ i }) {
  if (i.coverUrl) return <img className="ad-cn-thumb" src={i.coverUrl} alt="" loading="lazy" />;
  if (i.url) return <video className="ad-cn-thumb" src={`${i.url}#t=1`} muted preload="metadata" playsInline />;
  return <span className="ad-cn-thumb" />;
}

function Calendar({ month, setMonth, approved, posted }) {
  const today = todayTz();
  const map = {};
  const add = (k, x) => (map[k] ||= []).push(x);
  posted.forEach((i) => add(ymdTz(i.post.at), { i, label: POST_STATUS[i.post.status] || "Scheduled", cls: i.post.status === "published" || i.post.status === "partial" ? "posted" : "ready" }));
  approved.filter((i) => i.postOn).forEach((i) => add(i.postOn, { i, label: "Approved", cls: "ready" }));
  const title = new Date(`${month}-01T12:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  return (
    <section className="ad-cn-sec">
      <div className="ad-cal-nav">
        <button type="button" className="ad-iconbtn" aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}>
          <Icon name="left" />
        </button>
        <h2 className="ad-cal-title">{title}</h2>
        <button type="button" className="ad-iconbtn" aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))}>
          <Icon name="right" />
        </button>
      </div>
      <div className="ad-card ad-cn-cal">
        <div className="ad-cn-grid ad-cn-wd">
          {DAYS.map((x) => (
            <span key={x}>{x}</span>
          ))}
        </div>
        <div className="ad-cn-grid">
          {monthGrid(month).map((c) => (
            <div key={c.key} className={`ad-cn-day${c.inMonth ? "" : " is-out"}${c.key === today ? " is-today" : ""}`}>
              <span className="ad-cn-n">{c.day}</span>
              {c.inMonth &&
                (map[c.key] || []).map((x) => (
                  <span key={x.i.id} className={`ad-cn-tile is-${x.cls}`}>
                    <Thumb i={x.i} />
                    <span className="ad-cn-tile-t">
                      <small>{x.label}</small>
                      {firstLine(x.i.caption)}
                    </span>
                  </span>
                ))}
            </div>
          ))}
        </div>
      </div>
      <p className="ad-muted ad-cn-legend">
        <span>
          <i className="is-ready" />
          Approved or scheduled
        </span>
        <span>
          <i className="is-posted" />
          Posted
        </span>
      </p>
    </section>
  );
}

function QueueRow({ i, k, items, act, flash }) {
  const taken = takenDays(items, i.id);
  const days = nextDays(todayTz(), 21);
  if (i.postOn && !days.includes(i.postOn)) days.unshift(i.postOn);
  return (
    <li>
      <span className="ad-cn-num">{k + 1}</span>
      <Thumb i={i} />
      <span className="ad-cn-qb">
        <small>
          {i.postOn ? `Posts ${dayLabel(i.postOn, { weekday: "long", month: "short", day: "numeric" })}` : "No day picked yet"}
          {i.overlayText ? ` · text: “${i.overlayText}”` : ""}
        </small>
        <em>{i.caption || "No copy"}</em>
      </span>
      <span className="ad-cn-qa">
        <select className="ad-select" aria-label="Posting day" value={i.postOn || ""} onChange={(e) => act({ action: "day", id: i.id, postOn: e.target.value }, e.target.value ? "Posting day saved" : "Day removed")}>
          <option value="">Pick a day</option>
          {days.map((x) => (
            <option key={x} value={x} disabled={taken.has(x)}>
              {dayLabel(x)}
              {taken.has(x) ? " (taken)" : ""}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="ad-linkbtn"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(i.caption);
              flash("Copy copied");
            } catch {
              flash("Could not copy");
            }
          }}
        >
          Copy text
        </button>
        <button type="button" className="ad-linkbtn" onClick={() => act({ action: "pending", id: i.id }, "Back in “Waiting for your approval”")}>
          Back to approval
        </button>
      </span>
    </li>
  );
}

function ApprovalCard({ item: i, items, drafts, flash, reload }) {
  const d = (drafts.current[i.id] ||= { caption: i.caption, text: "", style: "shadow", position: "top", day: null });
  const [, rerender] = useState(0);
  const set = (patch) => {
    Object.assign(d, patch);
    rerender((n) => n + 1);
  };
  const [busy, setBusy] = useState("");
  const [saved, setSaved] = useState(false);
  const [cover, setCover] = useState(i.coverUrl);
  const [own, setOwn] = useState("");
  const [sure, setSure] = useState(false);
  const video = useRef(null);
  const canvas = useRef(null);

  const opts = (i.captions || []).filter((o) => o.text);
  const hooks = i.kind === "video" ? (i.hooks || []).filter((h) => h.text) : [];
  const taken = takenDays(items, i.id);
  const days = nextDays(todayTz(), 14);
  const others = new Set(Object.entries(drafts.current).filter(([id, x]) => id !== i.id && x.day).map(([, x]) => x.day));
  if (!d.day || taken.has(d.day)) d.day = defaultDay(days, taken, others);

  // live preview of the text, drawn by the same code that burns it into the video
  const paint = useCallback(() => {
    const v = video.current;
    const c = canvas.current;
    if (!v || !c) return;
    const w = v.clientWidth;
    const h = v.clientHeight;
    const s = Math.min(w / (v.videoWidth || 9), h / (v.videoHeight || 16));
    const cw = Math.round((v.videoWidth || 9) * s);
    const ch = Math.round((v.videoHeight || 16) * s);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = cw * dpr;
    c.height = ch * dpr;
    Object.assign(c.style, { width: `${cw}px`, height: `${ch}px`, left: `${Math.round((w - cw) / 2)}px`, top: `${Math.round((h - ch) / 2)}px` });
    const g = c.getContext("2d");
    g.clearRect(0, 0, c.width, c.height);
    if (d.text.trim()) drawOverlay(g, c.width, c.height, { text: d.text, style: d.style, position: d.position }, 1);
  }, [d]);
  useEffect(() => {
    paint();
    window.addEventListener("resize", paint);
    return () => window.removeEventListener("resize", paint);
  });

  const saveCover = async () => {
    const v = video.current;
    if (!v || !v.videoWidth) {
      flash("Play the video and pause on the frame you like.");
      return;
    }
    setBusy("Saving cover…");
    try {
      const c = document.createElement("canvas");
      const k = Math.min(1, 1080 / v.videoWidth);
      c.width = Math.round(v.videoWidth * k);
      c.height = Math.round(v.videoHeight * k);
      c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
      const blob = await new Promise((ok) => c.toBlob(ok, "image/jpeg", 0.9));
      const up = await api({ action: "upload", id: i.id, cover: true });
      if (!up.ok) throw new Error(up.error || "Could not save the cover");
      const put = await fetch(up.url, { method: "PUT", headers: { "Content-Type": "image/jpeg", "x-upsert": "false" }, body: blob });
      if (!put.ok) throw new Error("Could not save the cover");
      const r = await api({ action: "cover", id: i.id, coverPath: up.path, coverTime: Math.round(v.currentTime * 10) / 10 });
      if (!r.ok) throw new Error(r.error || "Could not save the cover");
      setCover(URL.createObjectURL(blob));
      flash("Cover saved");
    } catch (e) {
      flash(e.message);
    }
    setBusy("");
  };

  const approve = async () => {
    const caption = d.caption.trim();
    if (!caption) return flash("Write or pick a copy first.");
    try {
      let mediaPath = null;
      if (d.text.trim() && i.url && i.kind === "video") {
        setBusy("Getting the video…");
        const blob = await (await fetch(i.url)).blob();
        setBusy("Adding the text: 0%");
        const out = await burnText(new File([blob], i.name, { type: blob.type || "video/mp4" }), { text: d.text, style: d.style, position: d.position }, (p) => setBusy(`Adding the text: ${Math.round(p * 100)}%`));
        setBusy("Saving the video…");
        const up = await api({ action: "upload", id: i.id, ext: "mp4" });
        if (!up.ok) throw new Error(up.error || "Could not save the video");
        const put = await fetch(up.url, { method: "PUT", headers: { "Content-Type": "video/mp4", "x-upsert": "false" }, body: out });
        if (!put.ok) throw new Error("Could not upload the video with text");
        mediaPath = up.path;
      }
      setBusy("Approving…");
      const r = await api({ action: "approve", id: i.id, caption, mediaPath, overlayText: mediaPath ? d.text.trim() : "", postOn: d.day });
      if (!r.ok) throw new Error(r.error || "Could not approve");
      delete drafts.current[i.id];
      flash("Approved. Purple Roots will post it.");
      await reload();
    } catch (e) {
      flash(e.message || "Could not approve");
      setBusy("");
    }
  };

  const reject = async () => {
    if (!sure) {
      setSure(true);
      setTimeout(() => setSure(false), 3500);
      return;
    }
    setBusy("Discarding…");
    const r = await api({ action: "reject", id: i.id });
    if (!r.ok) {
      setBusy("");
      return flash(r.error || "Could not discard");
    }
    flash("Video discarded");
    await reload();
  };

  return (
    <article className="ad-card ad-cn-ap">
      <div className="ad-cn-media">
        <div className="ad-cn-video">
          {i.url ? (
            i.kind === "image" ? (
              <img src={i.url} alt="" />
            ) : (
              <>
                <video ref={video} src={cover ? i.url : `${i.url}#t=1`} poster={cover || undefined} controls playsInline preload={cover ? "none" : "metadata"} crossOrigin="anonymous" onLoadedMetadata={paint} />
                <canvas ref={canvas} />
              </>
            )
          ) : (
            <span className="ad-cn-ph">No preview</span>
          )}
        </div>
        {i.url && i.kind === "video" && (
          <div className="ad-cn-cov">
            <span className="ad-cn-cov-img">{cover ? <img src={cover} alt="Cover" /> : <small>No cover yet</small>}</span>
            <span>
              <b>{cover ? "Suggested cover" : "Cover"}</b>
              <small>{cover ? "This frame shows on the profile grid." : "Pause on a good frame and save it."}</small>
              <button type="button" className="ad-linkbtn" onClick={saveCover} disabled={!!busy}>
                Use the paused frame
              </button>
            </span>
          </div>
        )}
        {i.version > 1 && <p className="ad-cn-ver">Version {i.version}: the editor fixed this video</p>}
      </div>

      <div className="ad-cn-body">
        {opts.length > 1 && (
          <>
            <p className="ad-label">Pick a copy</p>
            <div className="ad-cn-opts">
              {opts.map((o, k) => (
                <button key={k} type="button" className="ad-cn-opt" aria-pressed={o.text === d.caption} onClick={() => (set({ caption: o.text }), setSaved(false))}>
                  <b>{CAPTION_KIND[o.kind] || `Option ${k + 1}`}</b>
                  <span>{o.text}</span>
                </button>
              ))}
            </div>
          </>
        )}
        <label className="ad-label" htmlFor={`cap-${i.id}`}>
          Final copy <span className="ad-muted">edit anything you want</span>
        </label>
        <textarea id={`cap-${i.id}`} className="ad-input ad-cn-ta" rows={8} maxLength={2200} value={d.caption} onChange={(e) => (set({ caption: e.target.value }), setSaved(false))} />
        <div className="ad-cn-row">
          <small className="ad-muted">{d.caption.length} / 2200</small>
          {d.caption !== i.caption ? (
            <button
              type="button"
              className="ad-linkbtn"
              onClick={async () => {
                const r = await api({ action: "save", id: i.id, caption: d.caption });
                if (!r.ok) return flash(r.error || "Could not save");
                i.caption = d.caption;
                setSaved(true);
              }}
            >
              Save changes without approving
            </button>
          ) : saved ? (
            <small className="ad-cn-saved">Saved</small>
          ) : null}
        </div>

        {hooks.length > 0 && (
          <details className="ad-cn-ov" open={!!d.text}>
            <summary>
              Text on the video <span className="ad-muted">optional</span>
            </summary>
            <div className="ad-cn-ovlist" role="radiogroup">
              {[{ text: "" }, ...hooks].map((h) => (
                <label key={h.text || "none"}>
                  <input type="radio" name={`ov-${i.id}`} checked={!own && d.text === h.text} onChange={() => (setOwn(""), set({ text: h.text }))} />
                  <span>{h.text || "No text"}</span>
                </label>
              ))}
            </div>
            <input className="ad-input" maxLength={120} placeholder="Or write your own" value={own} onChange={(e) => (setOwn(e.target.value), set({ text: e.target.value }))} />
            <div className="ad-cn-ovopts">
              <div className="ad-chips" role="group" aria-label="Style">
                {Object.entries(OVERLAY_STYLES).map(([k, v]) => (
                  <button key={k} type="button" className="ad-fchip" aria-pressed={d.style === k} onClick={() => set({ style: k })}>
                    {v}
                  </button>
                ))}
              </div>
              <div className="ad-chips" role="group" aria-label="Position">
                {Object.entries(POSITIONS).map(([k, v]) => (
                  <button key={k} type="button" className="ad-fchip" aria-pressed={d.position === k} onClick={() => set({ position: k })}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <p className="ad-muted ad-cn-hint">The preview shows exactly how it will look. It is added to the video when you approve.</p>
          </details>
        )}

        <p className="ad-label">Posting day</p>
        <div className="ad-cn-days">
          {days.map((x) => (
            <button key={x} type="button" className="ad-cn-dayc" aria-pressed={x === d.day} disabled={taken.has(x)} title={taken.has(x) ? "Another video posts this day" : undefined} onClick={() => set({ day: x })}>
              <small>{dayLabel(x, { weekday: "short" })}</small>
              <b>{dayLabel(x, { month: "short", day: "numeric" })}</b>
              {x === todayTz() && <i>Today</i>}
            </button>
          ))}
        </div>

        <div className="ad-cn-foot">
          <button type="button" className="ad-btn ad-btn--coral" disabled={!!busy} onClick={approve}>
            ✓ Approve
          </button>
          <button type="button" className="ad-btn ad-btn--ghost" disabled={!!busy} onClick={reject}>
            {sure ? "Discard? Tap again" : "Discard"}
          </button>
          {busy && (
            <span className="ad-muted" role="status">
              {busy}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
