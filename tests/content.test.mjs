// /admin/content: the day helpers and api/content.js (staff only, the
// Roots Engine token stays on the server, only known actions go through).
// Its own file so the mocked modules load before anything imports them.
import assert from "node:assert/strict";
import { mock, test } from "node:test";

import { defaultDay, monthGrid, nextDays, shiftMonth, takenDays } from "../src/admin/content.js";

test("any day of the week, taken days skipped, drafts do not collide", () => {
  const days = nextDays("2026-11-03", 7);
  assert.deepEqual(days, ["2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08", "2026-11-09"]);
  const items = [
    { id: "a", status: "approved", postOn: "2026-11-03" },
    { id: "b", status: "scheduled", post: { at: "2026-11-05T01:00:00Z" } }, // Nov 4 at 6 pm in El Paso
    { id: "c", status: "pending" },
  ];
  const taken = takenDays(items, "c");
  assert.deepEqual([...taken].sort(), ["2026-11-03", "2026-11-04"]);
  assert.equal(takenDays(items, "a").has("2026-11-03"), false, "a video's own day is not taken for itself");
  assert.equal(defaultDay(days, taken), "2026-11-05");
  assert.equal(defaultDay(days, taken, new Set(["2026-11-05"])), "2026-11-06");
  assert.equal(monthGrid("2026-11")[0].key, "2026-11-01");
  assert.equal(monthGrid("2026-11").length, 35);
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
});

test("api/content: staff only, token stays on the server, unknown actions refused", async () => {
  const calls = [];
  mock.module("@supabase/supabase-js", {
    namedExports: {
      createClient: () => ({
        auth: { getUser: async (t) => (t === "good" || t === "stranger" ? { data: { user: { id: t } }, error: null } : { data: null, error: { message: "bad jwt" } }) },
        from: () => {
          let id = null;
          const q = { select: () => q, eq: (_k, v) => ((id = v), q), maybeSingle: async () => ({ data: id === "good" ? { email: "deb@x.co", role: "owner" } : null }) };
          return q;
        },
      }),
    },
  });
  globalThis.fetch = async (url, opts = {}) => {
    calls.push({ url, method: opts.method || "GET", auth: opts.headers.Authorization, body: opts.body ? JSON.parse(opts.body) : null });
    if (!opts.method) return { ok: true, status: 200, json: async () => ({ items: [{ id: "x" }], slots: [], folders: { count: 1 } }) };
    const b = JSON.parse(opts.body);
    if (b.action === "upload") return { ok: true, status: 200, json: async () => ({ ok: true, path: "p", url: "u" }) };
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  };
  Object.assign(process.env, { SUPABASE_URL: "https://demo.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "srk", ROOTS_PANEL_TOKEN: "b".repeat(64) });
  const { default: handler } = await import("../api/content.js");
  const call = async (token, method = "GET", body) => {
    const res = { code: 0, body: null, headers: {}, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }, setHeader(k, v) { this.headers[k] = v; } };
    await handler({ method, headers: { authorization: token ? `Bearer ${token}` : "" }, body, query: {}, url: "/api/content" }, res);
    return res;
  };

  assert.equal((await call("")).code, 401);
  assert.equal((await call("stranger")).code, 401, "signed in but not staff");
  assert.equal(calls.length, 0, "nothing reaches Roots Engine without staff");

  const r = await call("good");
  assert.equal(r.code, 200);
  assert.deepEqual(r.body.items, [{ id: "x" }]);
  assert.equal(calls[0].url, "https://roots-engine.vercel.app/api/panel/content");
  assert.equal(calls[0].auth, `Bearer ${"b".repeat(64)}`);
  assert.equal(JSON.stringify(r.body).includes("b".repeat(64)), false, "the token never goes back");

  const a = await call("good", "POST", { action: "approve", id: "i", caption: "Hi", postOn: "2026-11-07", mediaPath: "m.mp4", overlayText: "Hook", extra: "drop me" });
  assert.equal(a.code, 200);
  assert.deepEqual(calls.at(-1).body, { action: "approve", id: "i", by: "Tippin' Cowgirl portal (deb@x.co)", caption: "Hi", mediaPath: "m.mp4", overlayText: "Hook", postOn: "2026-11-07" });

  const u = await call("good", "POST", { action: "upload", id: "i", cover: true });
  assert.deepEqual(u.body, { ok: true, path: "p", url: "u" });
  assert.equal(calls.at(-1).body.ext, "jpg");

  await call("good", "POST", { action: "refresh", id: "i" });
  assert.equal("id" in calls.at(-1).body, false);

  const before = calls.length;
  assert.equal((await call("good", "POST", { action: "deleteFolder", id: "i" })).code, 400);
  assert.equal(calls.length, before, "unknown actions never reach Roots Engine");

  delete process.env.ROOTS_PANEL_TOKEN;
  const s = await call("good");
  assert.equal(s.code, 503);
  assert.equal(s.body.setup, true);
});
