# Launch checklist

The site is live on **https://tippincowgirl.com** and open to search
engines. This file tracks what is left before a full launch. Work top to
bottom. You do not need to know anything about the project to follow it.

---

## Part 1: search engines

The pre launch block is gone. `public/robots.txt` allows everything and
points at the sitemap, the `noindex` meta tag is out of `index.html`, and
the `X-Robots-Tag` header is out of `vercel.json`.

### 1. Verify after the deploy

In a terminal:

```bash
curl -sI https://tippincowgirl.com/ | grep -i x-robots-tag
```

That should print **nothing**. If it still prints `noindex`, the deploy has
not finished.

Also open `https://tippincowgirl.com/robots.txt` in a browser and confirm it
says `Allow: /` and has the `Sitemap:` line.

### 2. Register the site with Google

1. Go to <https://search.google.com/search-console>.
2. Add a property for `tippincowgirl.com`. Pick the **Domain** option if you
   can add a DNS record, otherwise **URL prefix** and use the HTML tag
   method.
3. Once verified, open **Sitemaps** and submit `sitemap.xml`.
4. Use **URL Inspection** on the home page and click **Request indexing**.

Indexing takes days, not minutes. Do not panic on day one.

---

## Part 2: what else has to be true before a full launch

### Real prices

Every price in `src/shop/pricing.js` is still a placeholder tier, marked with
a `TODO(prices)` comment at the top of the list. They are the numbers the
site has been demoed with, not numbers the owner has approved.

Prices live in exactly one place. Change them in `pricing.js` and the
builder, the cart, Stripe and the order email all follow. Amounts are in
**whole cents**: `9800` means $98.00. Do not write `98`.

The shipping rule sits in the same file: flat rate for one hat, free from two
hats up. If it changes, the wording in `src/components/TrustPages.jsx`
(Shipping & Returns and FAQ) has to change with it.

### Production time

Nobody has confirmed how long a hat takes to build. Until the owner does,
nothing on the site or in the emails promises a date. When the number is
known, it goes in two places:

- `FULFILLMENT_NOTE` in `src/shop/customerEmail.js` (the customer email)
- the "How long does my hat take?" answer in `src/components/TrustPages.jsx`

### Stripe in live mode

The site is wired to Stripe **test** keys, which take fake cards and move no
money. Switching to live means:

1. In the Stripe dashboard, turn **off** Test mode.
2. **Developers > API keys**, copy the live secret key. It starts with
   `sk_live_` instead of `sk_test_`.
3. In Vercel, **Settings > Environment Variables**, replace
   `STRIPE_SECRET_KEY` with the live key for the Production environment.
4. Do not commit it anywhere. It is the one value on this page that can
   actually cost money if it leaks.

### The production webhook, with its own signing secret

This one catches people out, so read it carefully.

The webhook endpoint you set up for testing belongs to Stripe's **test
mode**. Live mode needs its **own endpoint**, and that endpoint has its
**own signing secret**. The test secret will not work in live mode, and the
symptom is the webhook failing with a 400 while everything looks correct.

1. With Test mode **off**, go to **Developers > Webhooks > Add endpoint**.
2. URL: `https://tippincowgirl.com/api/stripe-webhook`
3. Subscribe it to `checkout.session.completed` and nothing else.
4. Copy the signing secret it shows you. It starts with `whsec_`.
5. In Vercel, set `STRIPE_WEBHOOK_SECRET` to **that** value for Production.
6. Watch out for a trailing space or newline when pasting. That exact
   mistake has already cost this project an afternoon.
7. Redeploy. Environment variables do not reach functions that are already
   running.

Then place one real order with a real card, confirm both emails arrive,
and refund yourself from the Stripe dashboard.

### Sales tax

Not collected. `automatic_tax` is off in `api/create-checkout-session.js`
until the Texas registration is done in Stripe Tax.

### PUBLIC_BASE_URL

Set it in Vercel to `https://tippincowgirl.com` for Production, so the Stripe
return links and the "See this hat" links in the order email use the real
domain. Leave it unset on Preview.

---

## Quick status

| Item | Done |
| --- | --- |
| Search block removed in the code | yes |
| Verified with curl after deploy | no |
| Search Console set up and sitemap submitted | no |
| Real prices in pricing.js | no |
| Real production time confirmed | no |
| Stripe live secret key in Vercel | no |
| Live mode webhook with its own whsec | no |
| Sales tax | no |
| Domain in canonical, OG and sitemap | yes |
| www redirects to the root | yes |
| tippincowgirl.com verified in Resend | yes |
| Notification emails moved to the owner | yes |
| VITE_BOOKING_ENDPOINT set | yes |
| PUBLIC_BASE_URL set in Vercel | unconfirmed |
