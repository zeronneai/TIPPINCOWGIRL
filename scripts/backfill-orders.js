// ---------------------------------------------------------------------------
// One-off: copy every paid Stripe checkout into the staff portal's database.
//
//   npm run backfill:orders              insert what is missing
//   npm run backfill:orders -- --dry-run show what would be inserted, touch nothing
//
// For orders paid before the portal existed (or any the webhook could not
// store). Run it by hand, from your own computer, with these in a .env file
// next to package.json (never committed):
//
//   STRIPE_SECRET_KEY          the LIVE key for live orders (sk_live_...)
//   SUPABASE_URL               https://<project>.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY  service_role, server only
//
// WHAT IT DOES. Lists every Checkout Session (Stripe pages through all of
// them), keeps the ones with payment_status "paid", and stores each one
// with saveOrder() from api/_lib/orders.js, the same function and the same
// snapshot (buildOrderRecord) the webhook uses, so a backfilled order is
// identical to a live one. Like the webhook it reads the session itself
// (metadata, totals, customer and address), not its line items.
//
// SAFE TO RUN AGAIN. The insert is ON CONFLICT (stripe_session_id) DO
// NOTHING: an order already stored is left exactly as it is, status,
// tracking number and notes included.
//
// IT SENDS NO EMAIL. Nothing here imports the mailer.
//
// A session whose metadata is missing or unreadable (a checkout that did not
// come from the hat builder, say) is skipped and listed with the reason; the
// run carries on. Secret keys are never printed.
// ---------------------------------------------------------------------------

import { saveOrder } from "../api/_lib/orders.js";
import { buildOrderRecord } from "../src/shop/orderRecord.js";
import { isDirectRun, listNames, projectHost, redact } from "./lib/cli.js";

const money = (cents, currency = "usd") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: String(currency).toUpperCase() }).format((Number(cents) || 0) / 100);
const day = (iso) => (iso ? iso.slice(0, 10) : "no date");

/** Every paid Checkout Session, oldest page last, as Stripe pages them. */
export async function* paidSessions(stripe) {
  // `status: complete` narrows the list on Stripe's side; payment_status
  // is then checked here, since an async payment can complete unpaid.
  for await (const session of stripe.checkout.sessions.list({ limit: 100, status: "complete" })) {
    if (session.payment_status === "paid") yield session;
  }
}

/** Why a session cannot become an order, or null when it can. */
export function skipReason(session) {
  if (!session?.id) return "no session id";
  const { row, problems } = buildOrderRecord(session);
  if (problems.length) return problems.join(" | ");
  if (!row.hats.length) return "no hats in the metadata";
  return null;
}

/**
 * The backfill itself, with its clients passed in.
 *
 * @param {{stripe: object, db: object|null, dryRun?: boolean, log?: Function}} opts
 * @returns {Promise<{inserted: number, existed: number, skipped: number, wouldInsert: number}>}
 */
export async function backfill({ stripe, db, dryRun = false, log = console.log }) {
  const totals = { inserted: 0, existed: 0, skipped: 0, wouldInsert: 0 };
  const lines = [];
  for await (const session of paidSessions(stripe)) {
    const reason = skipReason(session);
    if (reason) {
      totals.skipped += 1;
      log(`skipped ${session?.id || "(no id)"}: ${reason}`);
      continue;
    }
    if (dryRun) {
      const { row } = buildOrderRecord(session);
      totals.wouldInsert += 1;
      lines.push(`${day(row.created_at)}  ${row.customer_name || "No name"}  ${money(row.total, row.currency)}  (${session.id})`);
      continue;
    }
    try {
      const saved = await saveOrder(session, db, { backfill: true });
      if (saved.inserted) totals.inserted += 1;
      else totals.existed += 1;
    } catch (err) {
      totals.skipped += 1;
      log(`skipped ${session.id}: the database refused it (${redact(err?.message || "unknown error")})`);
    }
  }
  // the one line summary always comes last
  if (dryRun) {
    for (const l of lines) log(`  ${l}`);
    log(`Dry run: ${totals.wouldInsert} paid orders would be inserted (any already stored are left untouched), ${totals.skipped} skipped. Nothing was written.`);
  } else {
    log(`Done: ${totals.inserted} inserted, ${totals.existed} already existed, ${totals.skipped} skipped.`);
  }
  return totals;
}

/**
 * The whole command, with its outputs passed in. Always prints a first line
 * (what it is about to do) and a last line (the summary, or the exact
 * error), and returns the exit code: a silent run is impossible.
 */
export async function main({ argv = process.argv, env = process.env, out = console.log, err = console.error, clients } = {}) {
  const dryRun = argv.includes("--dry-run");
  out(
    dryRun
      ? "Backfill orders (dry run): listing the paid Stripe checkouts that would be copied into the staff portal. Nothing is written."
      : "Backfill orders: copying every paid Stripe checkout into the staff portal. No email is sent."
  );
  const missing = ["STRIPE_SECRET_KEY", ...(dryRun ? [] : ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"])].filter((k) => !env[k]);
  if (missing.length) {
    // names only, never values
    err(`Missing ${listNames(missing)}. Set ${missing.length > 1 ? "them" : "it"} in .env (or the shell) and run it again: npm run backfill:orders${dryRun ? " -- --dry-run" : ""}. Nothing was changed.`);
    return 1;
  }
  try {
    let stripe;
    let db = null;
    if (clients) ({ stripe, db } = clients(env));
    else {
      const { default: Stripe } = await import("stripe");
      stripe = new Stripe(env.STRIPE_SECRET_KEY);
      if (!dryRun) {
        const { createClient } = await import("@supabase/supabase-js");
        db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
      }
    }
    out(`Stripe ${env.STRIPE_SECRET_KEY.startsWith("sk_live_") ? "live" : "test"} mode${dryRun ? "" : `, Supabase project ${projectHost(env.SUPABASE_URL)}`}.`);
    await backfill({ stripe, db, dryRun, log: out });
    return 0;
  } catch (e) {
    // Stripe names a rejected key in its message: redact() takes it out
    err(`Backfill stopped: ${redact(e?.message || e)}`);
    return 1;
  }
}

// exitCode, not exit(): on Windows a pipe is written asynchronously and
// process.exit() can cut the last lines off.
if (isDirectRun(import.meta.url)) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (e) => {
      console.error(`Backfill stopped: ${redact(e?.message || e)}`);
      process.exitCode = 1;
    }
  );
}
