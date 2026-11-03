// ---------------------------------------------------------------------------
// /api/content: the social media posts to approve, for the staff portal
// (/admin/content).
//
//   GET                       the videos waiting for approval, approved,
//                             scheduled and posted
//   POST { action, id, ... }  save | approve | reject | pending | upload |
//                             cover | day | refresh
//   Authorization: Bearer <the staff member's Supabase access token>
//
// The videos live in Roots Engine (Purple Roots Agency). The agency connects
// the Dropbox folder there; Roots Engine downloads each video, listens to it
// and writes the copy options and on screen text. This function checks that
// the caller is signed in AND on the `staff` table, then talks to Roots
// Engine with a token that never reaches a browser. The Dropbox link never
// comes through here.
//
// ENVIRONMENT VARIABLES (Vercel, then redeploy):
//   ROOTS_PANEL_TOKEN   required. Roots Engine: Tippin' Cowgirl > Aprobar >
//                       Panel propio del cliente > Copiar token.
//   ROOTS_ENGINE_URL    optional. Defaults to https://roots-engine.vercel.app
// ---------------------------------------------------------------------------

import { supabaseAdmin } from "./_lib/orders.js";
import { staffFor } from "./web-stats.js";

const DEFAULT_ENGINE = "https://roots-engine.vercel.app";
const ACTIONS = ["save", "approve", "reject", "pending", "upload", "cover", "day", "refresh"];
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const send = (res, code, body) => {
  res.setHeader("Cache-Control", "no-store");
  return res.status(code).json(body);
};
const engineToken = () => String(process.env.ROOTS_PANEL_TOKEN || "").trim().replace(/^["']|["']$/g, "");

/** What we forward to Roots Engine: only known actions and fields. */
export function engineBody(b = {}, by = "Tippin' Cowgirl portal") {
  if (!ACTIONS.includes(b.action)) return null;
  const body = { action: b.action, id: String(b.id || ""), by };
  if (b.action === "save" || b.action === "approve") body.caption = String(b.caption || "").slice(0, 2200);
  if (b.action === "approve" && b.mediaPath) {
    body.mediaPath = String(b.mediaPath);
    body.overlayText = String(b.overlayText || "").slice(0, 200);
  }
  if ((b.action === "approve" || b.action === "day") && DAY.test(String(b.postOn || ""))) body.postOn = b.postOn;
  if (b.action === "upload") body.ext = b.cover ? "jpg" : b.ext === "jpg" ? "jpg" : "mp4";
  if (b.action === "upload" && b.cover) body.cover = true;
  if (b.action === "cover") {
    body.coverPath = String(b.coverPath || "");
    body.coverTime = Number(b.coverTime);
  }
  if (b.action === "refresh") delete body.id;
  return body;
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return send(res, 405, { error: "Method not allowed" });
  }
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  const staff = await staffFor(token, supabaseAdmin()).catch(() => null);
  if (!staff) return send(res, 401, { error: "Sign in again to see the posts." });

  const key = engineToken();
  if (!key) {
    console.error("[content] ROOTS_PANEL_TOKEN is not set.");
    return send(res, 503, { error: "Content approval is not connected yet.", setup: true });
  }
  const base = (process.env.ROOTS_ENGINE_URL || DEFAULT_ENGINE).replace(/\/+$/, "");
  const url = `${base}/api/panel/content`;

  try {
    if (req.method === "GET") {
      const r = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
      if (r.status === 401) return send(res, 503, { error: "Content approval is not connected yet.", setup: true });
      if (!r.ok) return send(res, 502, { error: "Could not load the posts. Try again in a moment." });
      const j = await r.json();
      return send(res, 200, { items: j.items || [], slots: j.slots || [], folders: j.folders || null, at: j.at });
    }
    const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const body = engineBody(b, `Tippin' Cowgirl portal (${String(staff.email || "staff").slice(0, 40)})`);
    if (!body) return send(res, 400, { error: "Unknown action" });
    const r = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.ok) return send(res, 200, { ok: true, ...(b.action === "upload" ? { path: j.path, url: j.url } : {}) });
    if (r.status === 409) return send(res, 409, { error: "This video changed. Refresh the page." });
    return send(res, r.status === 401 ? 503 : 502, { error: j.error || "Could not save. Try again in a moment." });
  } catch (err) {
    console.error("[content] Roots Engine did not answer:", err?.message || err);
    return send(res, 502, { error: "Could not reach the content service. Try again in a moment." });
  }
}
