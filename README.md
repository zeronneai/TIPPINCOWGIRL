# Tippin Cowgirl — interactive landing page

> **Launch status:** the site is live on https://tippincowgirl.com and open
> to search engines. What is still pending before a full launch is tracked
> in **[LAUNCH-CHECKLIST.md](./LAUNCH-CHECKLIST.md)**.

A premium, single-page landing site for **Tippin Cowgirl**, the custom mobile
hat bar in El Paso, TX. The centerpiece is a "Mario-Kart"–style **hat
configurator**: pick the felt, shape the brim, wrap a band, pin a charm and
foil-stamp your initials — with a live SVG preview that recolors and
re-decorates in real time.

Implemented in **React + Vite**, ported from the Claude Design prototype in
`../project/Tippin Cowgirl.dc.html`.

## Run

```bash
npm install
npm run dev      # local dev server
npm run build    # production build to dist/
npm run preview  # preview the production build
```

## Checkout and environment variables

Payments run through Stripe Checkout. The browser never sends prices: it
posts only the chosen configuration to `api/create-checkout-session.js`,
which revalidates it and recomputes every amount with `src/shop/pricing.js`
(the single, pure source of truth for the price list, shared by the site and
the serverless function).

Set these in Vercel under **Project > Settings > Environment Variables**,
ticking Production, Preview and Development, then redeploy so the running
functions pick them up. Locally, put them in a `.env` file that is never
committed and run with `vercel dev` (plain `vite` does not serve `/api`).

| Variable | Required | What it is |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | yes | Secret key from Stripe, Developers > API keys. Use the test key (`sk_test_...`) until you are ready to take real money. Never commit it, never expose it to the browser, and never give it a `VITE_` prefix: anything with that prefix is bundled into the client. |
| `STRIPE_WEBHOOK_SECRET` | yes | Signing secret for the webhook endpoint, shown by Stripe under Developers > Webhooks when you add the endpoint. It starts with `whsec_` and is NOT the API key. Every endpoint has its own, and `stripe listen` for local testing prints a different one again. |
| `RESEND_API_KEY` | yes | From resend.com, API Keys. Used only to send the order notification. |
| `ORDER_NOTIFICATION_EMAIL` | yes | Where the order emails land. Orders send from `orders@tippincowgirl.com`, so this can be any address once the domain is verified in Resend. Until that verification finishes Resend refuses the send outright, which the webhook logs and survives. |
| `PUBLIC_BASE_URL` | no | Absolute site origin for the success and cancel URLs and for the "See this hat" links in the order email, e.g. `https://tippincowgirl.com`. Leave it unset to derive the origin from the request, which is what preview deployments want. |
| `VITE_BOOKING_ENDPOINT` | yes, for the events form | The Google Apps Script web app URL the private events form posts to, ending in `/exec`. Unlike every other variable here this one is read at BUILD time and baked into the client bundle, which the `VITE_` prefix makes explicit. That is fine: an Apps Script web app URL is not a secret, anyone can read it in the network tab. Without it the form refuses to send and tells the visitor to DM instead of failing quietly. Changing it needs a rebuild, not just a restart. |
| `VITE_GIVEAWAY_ENDPOINT` | yes, for /giveaway | The Apps Script web app URL for the giveaway entries. It is a **separate** script and Sheet from booking; the page refuses to send if this equals `VITE_BOOKING_ENDPOINT`. Read at build time, like the booking one. |

### The hat builder (v2)

A base plus optional stacked accessories: Feather, Cord (Suede Stitching
takes a color and an optional note), Brim bud (size, then color) and
Matches (color). Where things live:

- `src/shop/pricing.js`: ids, names, prices in cents, validation, the
  permalink format. Base prices are marked `TODO(price)`, accessory names
  `TODO(names)`. The burned brand is kept but off: `BRANDS_ENABLED = false`.
- `src/shop/catalog.js`: stacking order (base 10, feather 20, cord 30, bud 40,
  matches 50, all normal blend). Server safe.
- `src/shop/layers/` and `layers/thumbs/`: the accessory PNGs (1600px) and
  JPG thumbnails, turned into URLs by `src/shop/layerArt.js` (browser only).
- `src/shop/orderMetadata.js`: the Stripe metadata format, v2, with v1
  orders still readable.

The order emails flatten the hat with Cloudinary overlays, and the accessory
PNGs are not on Cloudinary yet, so a hat with accessories goes out without a
picture (the rows list every piece). Upload the 27 PNGs to Cloudinary and fill
`ACCESSORY_PUBLIC_IDS` in `catalog.js` to bring the picture back.

### Routing

Pages are clean paths handled by `src/router.js`, a tiny history router: `/`,
`/shipping-returns`, `/privacy`, `/terms`, `/faq`, `/giveaway`, and the two
Stripe return pages `/order-confirmed` and `/checkout-cancelled`. The
catch all rewrite in `vercel.json` serves `index.html` for every path that
is not a real file or `/api`, so entering any of them directly never 404s.

- Links are plain `<a href="/faq">`; one click handler turns them into
  client side navigation, so the app does not reload.
- Section anchors on the landing are written `/#builder`, `/#events`, so
  they work from any page.
- Old hash links (`/#/faq`, `/#/giveaway`...) are rewritten to the clean
  path before the first render, so anything already shared keeps working.
- Each indexable page sets its own `rel="canonical"`; `index.html` has none
  on purpose. The indexable list lives in `INDEXABLE_PATHS` and must match
  `public/sitemap.xml`.

### The giveaway page

`/giveaway` (old `/#/giveaway` links redirect to it) is a standalone entry page for the
giveaway with Girls Run The 915, shared only by link. It is not in the nav,
footer or sitemap, and it carries `noindex` both as a meta tag and, for the
path, as an `X-Robots-Tag` header in `vercel.json`. Code:
`src/components/Giveaway.jsx`, styles in `src/components/Giveaway.css` (loaded only with the page). The
draw date is the `DRAW_DATE` constant at the top of the component.

The prize photo is blurred by Cloudinary in the URL, so the browser only
ever receives blurred pixels. That does not protect the **original** upload,
which stays public at the same public id without the transformation. To
truly hide it until the reveal, upload a pre-blurred copy as its own asset
and point `PRIZE_ID` at it, then make the original private in Cloudinary or
remove it until reveal day.

Stripe returns customers to two real paths, which `vercel.json` rewrites to
the single page app: `/order-confirmed` and `/checkout-cancelled`. The cart
lives in the browser, so cancelling loses nothing, and the success page
empties the cart only when Stripe's `session_id` is on the URL.

## Order notifications

`api/stripe-webhook.js` listens for `checkout.session.completed`, verifies
the Stripe signature against the raw request body, and emails Deborah the
full build of every hat through Resend. Stripe's own receipt only says how
much was paid, which is not enough to make a hat.

Point Stripe at `https://tippincowgirl.com/api/stripe-webhook` under
Developers > Webhooks, subscribed to `checkout.session.completed`, and copy
the signing secret into `STRIPE_WEBHOOK_SECRET`. Test mode and live mode are
separate endpoints with separate signing secrets.

Mail goes out as `Tippin' Cowgirl <orders@tippincowgirl.com>`, which only
works once tippincowgirl.com is verified in Resend. If the order email stops
arriving, check the Resend dashboard before suspecting this code.

Two things worth knowing about that function: its body parser is switched
off on purpose (a parsed body breaks signature verification, and that is the
most common way Stripe webhooks fail), and it does not deduplicate. If
Stripe retries a delivery, the same order email arrives twice. That is the
deliberate trade for having no database: a duplicate email is cheaper than a
lost order.

## Structure

- `src/App.jsx` — page shell + all static sections (nav, marquee, hero,
  how-it-works, gallery, events, footer).
- `src/components/Configurator.jsx` — the interactive hat bar (state, step
  tabs, swatches, monogram input, build summary, shuffle).
- `src/hat/Hat3D.jsx` — the live **3D** hat (react-three-fiber). One
  parametric model recolors/reshapes for every felt × brim × band × charm
  combo (525 in all) — no combos authored by hand. Procedural crown + brim,
  felt micro-texture, in-engine studio reflections, drag-to-spin.
  - **Realistic GLB drop-in:** set `HAT_MODEL_URL` (top of the file) to a
    `.glb` whose meshes are named `crown` / `brim` / `band` / `charm`; the
    loader recolors the felt parts automatically and keeps all 525 combos.
  - **Felt textures:** swap the procedural bump in `useFeltBump()` for the
    brand's supplied felt normal/roughness maps when available.
- `src/hat/HatPreview.jsx` — the older 2D SVG hat (kept as a lightweight
  fallback reference).
- `src/hat/data.js` — felt / brim / band / charm option data + SVG path and
  color helpers, ported 1:1 from the design.
- `src/styles.css` — reset, keyframes (sway / marquee / glow), hover & focus
  states, and responsive breakpoints.
- `public/logo.png` — the brand mark (cowgirl-on-donkey), cropped from the
  Instagram profile, used in the nav, footer and favicon.

## Notes

- **Copy is in English** to match the brand's Instagram voice.
- The **gallery** uses tasteful placeholder tiles (`[ pop-up event photo ]`,
  etc.) — drop real photos into `public/` and swap the `GalleryTile`
  placeholders in `src/App.jsx` when you have them.
- Three design "tweaks" from the prototype are constants at the top of
  `Configurator.jsx`: `GLOW` (stage accent — terracotta by default),
  `SHOW_MARQUEE`, and `IDLE_SWAY`.
