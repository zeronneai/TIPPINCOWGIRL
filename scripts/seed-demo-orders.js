// ---------------------------------------------------------------------------
// Six demo orders for trying the staff portal, in every status.
//
//   node --env-file=.env scripts/seed-demo-orders.js            add them
//   node --env-file=.env scripts/seed-demo-orders.js --delete   remove them
//
// (npm run seed:demo and npm run seed:demo:delete do the same.)
//
// Run by hand only. It needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY and
// refuses to run when NODE_ENV is "production". Every demo order has a
// customer email ending in @demo.tippin and a stripe_session_id starting
// with cs_demo_, which is how --delete finds them (their history rows go
// with them). Running it twice adds nothing new: the session ids are fixed.
//
// The hats use real catalog ids and go through the same code as a real
// order (buildOrder, the Stripe metadata, buildOrderRecord), so they look
// exactly like what the webhook stores.
// ---------------------------------------------------------------------------

import { createClient } from "@supabase/supabase-js";
import { encodeOrderMetadata } from "../src/shop/orderMetadata.js";
import { buildOrderRecord } from "../src/shop/orderRecord.js";
import { buildOrder } from "../src/shop/pricing.js";

export const DEMO_EMAIL_SUFFIX = "@demo.tippin";
const DAY = 86400;

const stamp = (stampId, size = "large", position = "front") => ({ kind: "stamp", stampId, size, position });
const text = (t, font, size = "large", position = "front") => ({ kind: "text", text: t, font, size, position });

// [customer, address, cart, days ago, status, tracking, internal note, history]
export const DEMO_ORDERS = [
  {
    name: "Valeria Montoya",
    email: `valeria.montoya${DEMO_EMAIL_SUFFIX}`,
    address: { line1: "4812 Doniphan Dr", city: "El Paso", state: "TX", postal_code: "79932" },
    cart: [
      {
        baseId: "ivory",
        featherId: "natural",
        cordId: "stitching",
        cordColor: "rust",
        size: "m",
        quantity: 1,
        engraving: [text("VM", "durango"), stamp("horseshoe", "small", "left")],
      },
    ],
    daysAgo: 0.2,
    status: "new",
  },
  {
    name: "Brooke Harlan",
    email: `brooke.harlan${DEMO_EMAIL_SUFFIX}`,
    address: { line1: "1209 W 6th St", line2: "Apt 3", city: "Austin", state: "TX", postal_code: "78703" },
    cart: [
      { hatType: "suede", baseId: "camel", featherId: "cream", cordId: "heishi", budSize: "large", budColor: "red", size: "s-m", quantity: 1 },
      { hatType: "straw", baseId: "black", featherId: "guinea", cordId: "leather-rope", size: "l", quantity: 1 },
    ],
    daysAgo: 1,
    status: "in_production",
    history: [["in_production", "deborah", "Felt and bands pulled."]],
    note: "Wants both in the same box. Gift, no receipt inside.",
  },
  {
    name: "Ximena Castillo",
    email: `ximena.castillo${DEMO_EMAIL_SUFFIX}`,
    address: { line1: "77 Mesa Hills Dr", city: "El Paso", state: "TX", postal_code: "79912" },
    cart: [
      {
        baseId: "black",
        cordId: "rhinestone",
        budSize: "small",
        budColor: "orange",
        matchesColor: "turquoise",
        size: "s",
        quantity: 2,
        engraving: [text("XIMENA", "copperplate"), stamp("longhorn-skull", "small", "left")],
      },
    ],
    daysAgo: 3,
    status: "ready",
    history: [
      ["in_production", "deborah", null],
      ["ready", "deborah", "Both hats steamed and boxed."],
    ],
  },
  {
    name: "Hannah Brooks",
    email: `hannah.brooks${DEMO_EMAIL_SUFFIX}`,
    address: { line1: "3300 Camp Bowie Blvd", city: "Fort Worth", state: "TX", postal_code: "76107" },
    cart: [{ baseId: "baby-blue", featherId: "magenta", cordId: "concho-silver", size: "l", quantity: 1 }],
    daysAgo: 6,
    status: "shipped",
    tracking: "9400 1112 0206 2345 6789 01",
    history: [
      ["in_production", "deborah", null],
      ["ready", "deborah", null],
      ["shipped", "deborah", "USPS Priority."],
    ],
  },
  {
    name: "Maria Elena Ruiz",
    email: `maria.ruiz${DEMO_EMAIL_SUFFIX}`,
    address: { line1: "512 N Mesa St", city: "Las Cruces", state: "NM", postal_code: "88001" },
    cart: [
      { baseId: "wine", featherId: "polka", cordId: "barbed-wire", matchesColor: "red", size: "xl", quantity: 1, engraving: [stamp("star-outline"), text("RUIZ", "original")] },
    ],
    daysAgo: 14,
    status: "delivered",
    tracking: "9400 1112 0206 9876 5432 10",
    history: [
      ["in_production", "deborah", null],
      ["ready", "deborah", null],
      ["shipped", "deborah", null],
      ["delivered", "deborah", "Customer sent a photo, loves it."],
    ],
  },
  {
    name: "Caitlyn Moore",
    email: `caitlyn.moore${DEMO_EMAIL_SUFFIX}`,
    address: { line1: "88 Ranch Rd 12", city: "Wimberley", state: "TX", postal_code: "78676" },
    cart: [{ hatType: "suede", baseId: "navy", cordId: "turquoise", size: "l-xl", quantity: 1 }],
    daysAgo: 9,
    status: "cancelled",
    history: [["cancelled", "deborah", "Refunded in Stripe at the customer's request."]],
  },
];

/** A Stripe checkout session shaped like the real one, for a demo order. */
export function demoSession(demo, index, now = Math.floor(Date.now() / 1000)) {
  const order = buildOrder(demo.cart);
  return {
    id: `cs_demo_${String(index + 1).padStart(2, "0")}_${demo.email.split("@")[0].replace(/\W/g, "")}`,
    object: "checkout.session",
    created: Math.round(now - demo.daysAgo * DAY),
    payment_status: "paid",
    currency: "usd",
    amount_subtotal: order.subtotal,
    amount_total: order.total,
    total_details: { amount_shipping: order.shipping },
    customer_details: { name: demo.name, email: demo.email, phone: "+1 915 555 01" + String(index).padStart(2, "0") },
    shipping_details: { name: demo.name, address: { ...demo.address, line2: demo.address.line2 || null, country: "US" } },
    metadata: encodeOrderMetadata(order),
  };
}

function client() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (for example in .env, then run with node --env-file=.env).");
    process.exit(1);
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function removeDemo(db) {
  const { data, error } = await db.from("orders").delete().like("customer_email", `%${DEMO_EMAIL_SUFFIX}`).select("id");
  if (error) throw new Error(error.message);
  console.log(`Removed ${data.length} demo orders (and their history).`);
}

async function seed(db) {
  const now = Math.floor(Date.now() / 1000);
  let added = 0;
  for (const [i, demo] of DEMO_ORDERS.entries()) {
    const session = demoSession(demo, i, now);
    const { row } = buildOrderRecord(session);
    const { data, error } = await db
      .from("orders")
      .upsert({ ...row, status: demo.status, tracking_number: demo.tracking || null, internal_notes: demo.note || null }, { onConflict: "stripe_session_id", ignoreDuplicates: true })
      .select("id");
    if (error) throw new Error(error.message);
    if (!data.length) {
      console.log(`  already there: ${demo.name}`);
      continue;
    }
    // the history a real order would have built up, a few hours apart
    const created = session.created;
    const events = [{ actor_email: "stripe", from_status: null, to_status: "new", note: "Paid on Stripe", at: created }];
    let from = "new";
    (demo.history || []).forEach(([to, who, note], k) => {
      events.push({ actor_email: `${who}${DEMO_EMAIL_SUFFIX}`, from_status: from, to_status: to, note, at: created + (k + 1) * 0.15 * DAY });
      from = to;
    });
    const { error: evError } = await db.from("order_events").insert(
      events.map(({ at, ...e }) => ({ ...e, order_id: data[0].id, created_at: new Date(Math.min(at, now) * 1000).toISOString() }))
    );
    if (evError) throw new Error(evError.message);
    added += 1;
    console.log(`  added: ${demo.name} (${demo.status})`);
  }
  console.log(`Done: ${added} demo orders added. Remove them with: npm run seed:demo:delete`);
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("Refusing to run: NODE_ENV is production. Demo orders are for a test project.");
    process.exit(1);
  }
  const db = client();
  if (process.argv.includes("--delete")) await removeDemo(db);
  else await seed(db);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error("Seeding failed:", err.message);
    process.exit(1);
  });
}
