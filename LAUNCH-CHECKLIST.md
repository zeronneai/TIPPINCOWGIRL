# Launch checklist

**Right now this site is deliberately hidden from Google and every other
search engine.** That is on purpose: the catalog prices are still
provisional, and a page that gets indexed with the wrong prices is hard to
take back. The site works normally for anyone you send the link to. It just
will not turn up in search results.

This file is the full list of what to undo, and what else has to be true,
before the site goes live for real. Work top to bottom. You do not need to
know anything about the project to follow it.

---

## Part 1: take the search block down

The block has **three layers**, and they only work as a set. Removing one
and leaving the others does nothing useful, so do all three in the same
change and deploy them together.

### 1. `public/robots.txt`

Replace the whole file with the four lines kept in the comment at the top of
it:

```
User-agent: *
Allow: /

Sitemap: https://tippincowgirl.com/sitemap.xml
```

That Sitemap URL is already the live domain, so it is a straight copy and
paste. `public/sitemap.xml` already exists and has been sitting there
untouched; this is the line that puts it back in play.

### 2. `index.html`

Delete this tag from the `<head>`, along with the comment above it:

```html
<meta name="robots" content="noindex, nofollow" />
```

### 3. `vercel.json`

Delete the entire `headers` block, leaving `rewrites` alone:

```json
"headers": [
  {
    "source": "/(.*)",
    "headers": [{ "key": "X-Robots-Tag", "value": "noindex, nofollow" }]
  }
],
```

This is the layer that matters most. It works even for crawlers that never
read the HTML, and it covers files that are not pages. If you only have time
to check one thing after deploying, check this one.

### 4. Deploy and verify

Push the change and let Vercel deploy. Then confirm the block is really gone.
In a terminal:

```bash
curl -sI https://tippincowgirl.com/ | grep -i x-robots-tag
```

That should print **nothing**. If it still prints `noindex`, the deploy has
not finished or the `headers` block is still in `vercel.json`.

Also open `https://tippincowgirl.com/robots.txt` in a browser and confirm it
says `Allow: /` and not `Disallow: /`.

### 5. Only now, register the site with Google

Do this **after** the three layers are down and verified, not before. Adding
a blocked site to Search Console just teaches Google that it is blocked.

1. Go to <https://search.google.com/search-console>.
2. Add a property for `tippincowgirl.com`. Pick the **Domain** option if you
   can add a DNS record, otherwise **URL prefix** and use the HTML tag
   method.
3. Once verified, open **Sitemaps** and submit `sitemap.xml`.
4. Use **URL Inspection** on the home page and click **Request indexing**.

Indexing takes days, not minutes. Do not panic on day one.

---

## Part 2: what else has to be true before launch

These are separate from the search block and every one of them is a real
blocker. Search visibility with any of these unfinished is worse than no
search visibility at all.

### Real prices

Every price in `src/shop/pricing.js` is still a placeholder tier, marked with
a `TODO(prices)` comment at the top of the list. They are the numbers the
site has been demoed with, not numbers the owner has approved.

Prices live in exactly one place. Change them in `pricing.js` and the
builder, the cart, Stripe and the order email all follow. Amounts are in
**whole cents**: `9800` means $98.00. Do not write `98`.

The shipping rule sits in the same file: flat rate for one hat, free from two
hats up. Confirm that is still what the owner wants.

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

Then place one real order with a real card, confirm the order email arrives,
and refund yourself from the Stripe dashboard.

### The domain in the metadata

Done in the code. `index.html` (canonical, Open Graph, Twitter card and the
structured data block) and `public/sitemap.xml` all point at
`https://tippincowgirl.com`, with every image URL absolute.

One thing is still a dashboard setting, not code: set `PUBLIC_BASE_URL` in
Vercel to `https://tippincowgirl.com` for Production, so the Stripe return
links and the "See this hat" links in the order email use the real domain.
Leave it unset on Preview, where deriving the origin from the request is
what you want.

### The order email sender

The code already sends as `Tippin' Cowgirl <orders@tippincowgirl.com>`. What
is left is the Resend side: add tippincowgirl.com under Domains in Resend
and publish the DNS records it gives you, for SPF and DKIM. Until that shows
as verified, Resend refuses the send. The webhook logs the refusal and still
answers Stripe with a 200, so the symptom is a silent missing email, not a
failed payment. Place one test order after verifying and confirm the mail
lands.

### The events form endpoint

`VITE_BOOKING_ENDPOINT` must be set in Vercel, pointing at the Google Apps
Script web app URL. Unlike the others this one is read when the site is
**built**, so after changing it you need a fresh deploy, not just a restart.

---

## Quick status

| Item | Done |
| --- | --- |
| robots.txt unblocked | no |
| meta robots removed | no |
| X-Robots-Tag header removed | no |
| Verified with curl after deploy | no |
| Search Console set up and sitemap submitted | no |
| Real prices in pricing.js | no |
| Stripe live secret key in Vercel | no |
| Live mode webhook with its own whsec | no |
| Domain updated in canonical, OG and sitemap | yes, in the code |
| PUBLIC_BASE_URL set to the real domain in Vercel | no |
| tippincowgirl.com verified in Resend | no |
| VITE_BOOKING_ENDPOINT set | no |
