// /admin/website: the shaping of Roots Engine's numbers, and api/web-stats.js
// (staff only, token kept on the server). Its own file so the mocked
// modules load before anything imports them.
import assert from "node:assert/strict";
import { mock, test } from "node:test";

import { duration, shapeWebStats, sourceName } from "../src/admin/web.js";

const PAYLOAD = {
  domain: "tippincowgirl.com",
  days: 7,
  live: { active: 2, pages: [{ name: "/", n: 2 }] },
  stats: {
    visitors: 40,
    sessions: 52,
    pageviews: 130,
    avgSessionSeconds: 95,
    bounceRate: 31,
    sources: [{ name: "Instagram", n: 30 }, { name: "Directo", n: 12 }, { name: "Facebook (anuncio)", n: 10 }],
    devices: [{ name: "Celular", n: 45 }, { name: "Compu", n: 7 }],
    cities: [{ name: "El Paso", n: 90 }],
    clicks: [{ name: "Botón sin texto (ícono o flecha)", n: 3 }, { name: "Botón: Checkout", n: 2 }],
    pages: [{ path: "/", title: "Tippin' Cowgirl", views: 80, visitors: 35, avgSeconds: 70 }],
    series: [{ day: "2026-10-30", views: 20, visitors: 9 }],
  },
};

test("Roots Engine's Spanish labels come out in English, numbers intact", () => {
  const v = shapeWebStats(PAYLOAD);
  assert.deepEqual(v.k, { visitors: 40, sessions: 52, pageviews: 130, avgTime: "1m 35s", bounceRate: 31 });
  assert.deepEqual(v.sources.map((s) => s.label), ["Instagram", "Direct (typed or saved link)", "Facebook (ad)"]);
  assert.deepEqual(v.devices.map((d) => [d.name, d.value]), [["Phone", 45], ["Computer", 7]]);
  assert.deepEqual(v.clicks.map((c) => c.label), ["Button with no text (icon or arrow)", "Checkout"]);
  assert.equal(v.series[0].label, "Oct 30");
  assert.equal(v.liveNow, 2);
  assert.equal(v.empty, false);
  assert.equal(shapeWebStats({}).empty, true);
  assert.equal(sourceName("Google"), "Google");
  assert.equal(duration(5), "5s");
});

test("api/web-stats: staff only, the read token stays on the server", async () => {
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
  globalThis.fetch = async (url, opts) => (calls.push({ url, auth: opts.headers.Authorization }), { ok: true, status: 200, json: async () => PAYLOAD });
  Object.assign(process.env, { SUPABASE_URL: "https://demo.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "srk", ROOTS_ENGINE_TOKEN: "a".repeat(64) });
  const { default: handler } = await import("../api/web-stats.js");
  const call = async (token, days) => {
    const res = { code: 0, body: null, headers: {}, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }, setHeader(k, v) { this.headers[k] = v; } };
    await handler({ method: "GET", headers: token ? { authorization: `Bearer ${token}` } : {}, query: { days }, url: `/api/web-stats?days=${days}` }, res);
    return res;
  };
  const errs = mock.method(console, "error", () => {});
  try {
    assert.equal((await call(null, "7")).code, 401);
    assert.equal((await call("junk", "7")).code, 401);
    assert.equal((await call("stranger", "7")).code, 401, "signed in but not staff");
    assert.equal(calls.length, 0, "Roots Engine is never asked for an outsider");

    const ok = await call("good", "30");
    assert.equal(ok.code, 200);
    assert.equal(ok.body.domain, "tippincowgirl.com");
    assert.equal(ok.headers["Cache-Control"], "no-store");
    assert.equal(calls[0].url, "https://roots-engine.vercel.app/api/sites/stats?dias=30");
    assert.equal(calls[0].auth, `Bearer ${"a".repeat(64)}`);
    await call("good", "999");
    assert.match(calls[1].url, /dias=7$/, "an odd range falls back to 7 days");

    delete process.env.ROOTS_ENGINE_TOKEN;
    const off = await call("good", "7");
    assert.deepEqual([off.code, off.body.setup], [503, true]);
  } finally {
    errs.mock.restore();
  }
});
