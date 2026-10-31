// ---------------------------------------------------------------------------
// /api/web-stats: the site's visits for the staff portal (/admin/website).
//
//   GET ?days=1|7|30|90     Authorization: Bearer <the staff member's
//                           Supabase access token>
//
// The visits are counted by Roots Engine (the t.js script in index.html).
// This function is the only thing that talks to it: it checks that the
// caller is signed in AND on the `staff` table, then asks Roots Engine for
// this site's numbers with a read only token that never reaches a browser.
//
// ENVIRONMENT VARIABLES (Vercel, then redeploy):
//   ROOTS_ENGINE_TOKEN   required. The site's read token, copied in Roots
//                        Engine: Tippin' Cowgirl > Sitio web > Código del
//                        sitio y opciones > Copiar token.
//   ROOTS_ENGINE_URL     optional. Defaults to https://roots-engine.vercel.app
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   already set for the portal.
// ---------------------------------------------------------------------------

import { supabaseAdmin } from "./_lib/orders.js";

export const WEB_STATS_DAYS = [1, 7, 30, 90];
const DEFAULT_ENGINE = "https://roots-engine.vercel.app";

const send = (res, code, body) => {
  res.setHeader("Cache-Control", "no-store");
  return res.status(code).json(body);
};

/** The signed in staff row for a Supabase access token, or null. */
export async function staffFor(token, client) {
  if (!client || !token) return null;
  const { data: auth, error } = await client.auth.getUser(token);
  if (error || !auth?.user) return null;
  const { data } = await client.from("staff").select("email, role").eq("user_id", auth.user.id).maybeSingle();
  return data || null;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return send(res, 405, { error: "Method not allowed" });
  }

  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  const staff = await staffFor(token, supabaseAdmin()).catch(() => null);
  if (!staff) return send(res, 401, { error: "Sign in again to see the website numbers." });

  // trimmed, and quotes dropped: a token pasted as "abc..." or with a
  // trailing space or newline still works
  const engineToken = String(process.env.ROOTS_ENGINE_TOKEN || "").trim().replace(/^["']|["']$/g, "");
  if (!engineToken) {
    console.error("[web-stats] ROOTS_ENGINE_TOKEN is not set.");
    return send(res, 503, { error: "Website numbers are not connected yet.", setup: true });
  }

  const asked = Number(req.query?.days ?? new URL(req.url, "http://x").searchParams.get("days"));
  const days = WEB_STATS_DAYS.includes(asked) ? asked : 7;
  const base = (process.env.ROOTS_ENGINE_URL || DEFAULT_ENGINE).replace(/\/+$/, "");

  try {
    const r = await fetch(`${base}/api/sites/stats?dias=${days}`, { headers: { Authorization: `Bearer ${engineToken}` } });
    if (r.status === 401) {
      console.error("[web-stats] Roots Engine refused the token. Copy it again into ROOTS_ENGINE_TOKEN.");
      return send(res, 503, { error: "Website numbers are not connected yet.", setup: true });
    }
    if (!r.ok) return send(res, 502, { error: "Could not load the website numbers. Try again in a moment." });
    const data = await r.json();
    return send(res, 200, data);
  } catch (err) {
    console.error("[web-stats] Roots Engine did not answer:", err?.message || err);
    return send(res, 502, { error: "Could not load the website numbers. Try again in a moment." });
  }
}
