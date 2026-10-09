// The command line scripts actually run when called, on any path, and are
// never silent. Spawned as real child processes with no environment, so
// nothing here can reach Supabase or Stripe.
//
//   npm test
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { isDirectRun, listNames, redact } from "../scripts/lib/cli.js";
import { main as seedMain } from "../scripts/seed-demo-orders.js";
import { main as backfillMain } from "../scripts/backfill-orders.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const SEED = path.join(root, "scripts", "seed-demo-orders.js");
const BACKFILL = path.join(root, "scripts", "backfill-orders.js");
// an environment with no Supabase, Stripe or NODE_ENV at all
const bare = { PATH: process.env.PATH, SYSTEMROOT: process.env.SYSTEMROOT };
const run = (file, args = [], env = bare) => spawnSync(process.execPath, [file, ...args], { env, encoding: "utf8", cwd: root });

test("seed-demo-orders.js run directly with no env: says what it was doing, names what is missing, exits 1", () => {
  const r = run(SEED);
  assert.equal(r.status, 1);
  assert.equal(r.stdout.split("\n")[0], "Seed demo orders: adding 6 demo orders (emails ending in @demo.tippin).");
  assert.match(r.stderr, /^Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY\. .*Nothing was changed\.\n$/);

  const d = run(SEED, ["--delete"]);
  assert.equal(d.status, 1);
  assert.equal(d.stdout.split("\n")[0], "Seed demo orders: deleting every order whose email ends in @demo.tippin.");
  assert.match(d.stderr, /^Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY\./);

  const only = run(SEED, [], { ...bare, SUPABASE_URL: "https://x.supabase.co" });
  assert.match(only.stderr, /^Missing SUPABASE_SERVICE_ROLE_KEY\. Set it/);
  const prod = run(SEED, [], { ...bare, NODE_ENV: "production", SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k" });
  assert.equal(prod.status, 1);
  assert.match(prod.stderr, /Refusing to run: NODE_ENV is production/);
});

test("backfill-orders.js run directly with no env: same, for both modes", () => {
  const r = run(BACKFILL);
  assert.equal(r.status, 1);
  assert.equal(r.stdout.split("\n")[0], "Backfill orders: copying every paid Stripe checkout into the staff portal. No email is sent.");
  assert.match(r.stderr, /^Missing STRIPE_SECRET_KEY, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY\. .*Nothing was changed\.\n$/);

  const dry = run(BACKFILL, ["--dry-run"]);
  assert.equal(dry.status, 1);
  assert.match(dry.stdout, /^Backfill orders \(dry run\)/);
  assert.match(dry.stderr, /^Missing STRIPE_SECRET_KEY\. Set it/);
});

test("imported (as the tests do), the scripts do nothing at all", () => {
  const r = spawnSync(process.execPath, ["--input-type=module", "-e", `await import(${JSON.stringify(pathToFileURL(SEED).href)}); await import(${JSON.stringify(pathToFileURL(BACKFILL).href)});`], { env: bare, encoding: "utf8" });
  assert.deepEqual([r.status, r.stdout, r.stderr], [0, "", ""]);
});

test("still runs from a folder with a space in its name, through a symlink", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "tippin portal "));
  try {
    const link = path.join(dir, "seed demo.js");
    symlinkSync(SEED, link);
    const r = run(link);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /^Seed demo orders: adding 6 demo orders/);
    assert.match(r.stderr, /^Missing SUPABASE_URL/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("isDirectRun: Windows paths, encoded characters, symlinks, and imports", () => {
  // the bug: Windows URL vs Windows path
  assert.equal(isDirectRun("file:///C:/Users/Deb/repo/scripts/seed-demo-orders.js", "C:\\Users\\Deb\\repo\\scripts\\seed-demo-orders.js", "win32"), true);
  assert.equal(isDirectRun("file:///C:/Users/Deb/repo/scripts/seed-demo-orders.js", "c:\\users\\deb\\repo\\scripts\\SEED-demo-orders.js", "win32"), true, "case insensitive on Windows");
  assert.equal(isDirectRun("file:///C:/Users/Deb%20Ruiz/Tippin%C3%A9/scripts/seed.js", "C:\\Users\\Deb Ruiz\\Tippiné\\scripts\\seed.js", "win32"), true, "spaces and accents");
  assert.equal(isDirectRun("file:///C:/repo/scripts/seed.js", "C:\\repo\\scripts\\backfill.js", "win32"), false);
  // posix: encoded space, and a different file
  assert.equal(isDirectRun("file:///home/deb/my%20repo/scripts/seed.js", "/home/deb/my repo/scripts/seed.js", "linux"), true);
  assert.equal(isDirectRun("file:///home/deb/repo/scripts/seed.js", "/home/deb/repo/scripts/other.js", "linux"), false);
  assert.equal(isDirectRun("file:///home/deb/repo/scripts/seed.js", "/home/deb/Repo/scripts/seed.js", "linux"), false, "case matters on Linux");
  // nothing to compare: an import from node -e or a test runner
  assert.equal(isDirectRun(pathToFileURL(SEED).href, undefined), false);
  assert.equal(isDirectRun(undefined, SEED), false);
  assert.equal(listNames(["A", "B", "C"]), "A, B and C");
});

// ---- never silent, never a key ---------------------------------------------------------------------
const capture = () => {
  const out = [];
  const err = [];
  return { out, err, o: (l) => out.push(l), e: (l) => err.push(l) };
};
const ENV = { SUPABASE_URL: "https://abcd.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.c2VjcmV0" };

test("a Supabase error is printed with its message, code and hint, and the run ends on it", async () => {
  const c = capture();
  const failing = { from: () => ({ upsert: () => ({ select: async () => ({ data: null, error: { message: 'relation "public.orders" does not exist', code: "42P01", hint: "Run supabase/schema.sql first." } }) }) }) };
  const code = await seedMain({ argv: ["node", "seed"], env: ENV, out: c.o, err: c.e, connect: () => failing });
  assert.equal(code, 1);
  assert.equal(c.out[0], "Seed demo orders: adding 6 demo orders (emails ending in @demo.tippin).");
  assert.equal(c.out[1], "Supabase project: abcd.supabase.co");
  assert.deepEqual(c.err, [`Failed: Supabase refused Valeria Montoya's order after 0 added: relation "public.orders" does not exist (code 42P01) Hint: Run supabase/schema.sql first.`]);
  assert.ok(![...c.out, ...c.err].join("\n").includes(ENV.SUPABASE_SERVICE_ROLE_KEY), "the key is never printed");
});

test("a successful seed and delete end with their counts", async () => {
  let n = 0;
  const ok = {
    from: (table) => ({
      upsert: () => ({ select: async () => ({ data: n++ % 2 ? [] : [{ id: `id-${n}` }], error: null }) }),
      insert: async () => ({ error: null }),
      delete: () => ({ like: () => ({ select: async () => ({ data: [{ id: 1 }, { id: 2 }], error: null }) }) }),
      table,
    }),
  };
  const c = capture();
  assert.equal(await seedMain({ argv: ["node", "seed"], env: ENV, out: c.o, err: c.e, connect: () => ok }), 0);
  assert.equal(c.out.at(-1), "Done: 3 demo orders added, 3 already there. Remove them with: npm run seed:demo:delete");
  const d = capture();
  assert.equal(await seedMain({ argv: ["node", "seed", "--delete"], env: ENV, out: d.o, err: d.e, connect: () => ok }), 0);
  assert.equal(d.out.at(-1), "Done: deleted 2 demo orders (and their history).");
  assert.deepEqual([c.err, d.err], [[], []]);
});

test("a Stripe error naming the key is redacted before it is printed", async () => {
  const c = capture();
  const stripe = {
    checkout: {
      sessions: {
        list() {
          return {
            async *[Symbol.asyncIterator]() {
              throw new Error("Invalid API Key provided: sk_live_****WXYZ");
            },
          };
        },
      },
    },
  };
  const code = await backfillMain({ argv: ["node", "backfill", "--dry-run"], env: { STRIPE_SECRET_KEY: "sk_live_realsecret123" }, out: c.o, err: c.e, clients: () => ({ stripe, db: null }) });
  assert.equal(code, 1);
  assert.deepEqual(c.err, ["Backfill stopped: Invalid API Key provided: [redacted key]"]);
  assert.ok(!/sk_live|realsecret|WXYZ/.test([...c.out, ...c.err].join("\n")));
  assert.equal(redact("eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.sig and whsec_abc and rk_test_123"), "[redacted key] and [redacted key] and [redacted key]");
});
