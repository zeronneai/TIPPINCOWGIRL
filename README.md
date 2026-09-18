# Tippin Cowgirl — interactive landing page

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
| `ORDER_NOTIFICATION_EMAIL` | yes | Where the order emails land. While the sender is still `onboarding@resend.dev`, Resend will only deliver to the address that owns the Resend account. |
| `PUBLIC_BASE_URL` | no | Absolute site origin for the success and cancel URLs and for the "See this hat" links in the order email, e.g. `https://tippincowgirl.vercel.app`. Leave it unset to derive the origin from the request, which is what preview deployments want. |
| `VITE_BOOKING_ENDPOINT` | yes, for the events form | The Google Apps Script web app URL the private events form posts to, ending in `/exec`. Unlike every other variable here this one is read at BUILD time and baked into the client bundle, which the `VITE_` prefix makes explicit. That is fine: an Apps Script web app URL is not a secret, anyone can read it in the network tab. Without it the form refuses to send and tells the visitor to DM instead of failing quietly. Changing it needs a rebuild, not just a restart. |

Stripe returns customers to two real paths, which `vercel.json` rewrites to
the single page app: `/order-confirmed` and `/checkout-cancelled`. The cart
lives in the browser, so cancelling loses nothing, and the success page
empties the cart only when Stripe's `session_id` is on the URL.

## Order notifications

`api/stripe-webhook.js` listens for `checkout.session.completed`, verifies
the Stripe signature against the raw request body, and emails Deborah the
full build of every hat through Resend. Stripe's own receipt only says how
much was paid, which is not enough to make a hat.

Point Stripe at `https://<your domain>/api/stripe-webhook` under
Developers > Webhooks, subscribed to `checkout.session.completed`, and copy
the signing secret into `STRIPE_WEBHOOK_SECRET`.

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
