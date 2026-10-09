# Staff portal setup (phase 1: orders)

The portal lives at **/admin** on the site. Staff sign in with an email and
password, see every paid order (newest first), and move each one through
New, In production, Ready, Shipped, Delivered or Cancelled. Every change is
kept in the order's history.

Orders get there by themselves: when Stripe confirms a payment, the webhook
that already sends the order emails also saves the order in the database.

You do this once, in about fifteen minutes.

## 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com), sign in, and click **New project**.
2. Name it (for example `tippin-cowgirl`), choose a strong database password
   (save it in your password manager), pick the region closest to Texas
   (for example *East US*), and create it.
3. Wait until the project says it is ready.

## 2. Create the tables (run schema.sql)

1. In the project, open **SQL Editor** (left menu) and click **New query**.
2. Open `supabase/schema.sql` from this repository, copy **all** of it, and
   paste it into the editor.
3. Click **Run**. It should finish with "Success. No rows returned".

Running it again later is safe; it only creates what is missing.

## 3. Create the first owner (Deborah)

1. Open **Authentication > Users** and click **Add user > Create new user**.
2. Enter Deborah's email and a password, tick **Auto Confirm User**, and
   click **Create user**.
3. Click the new user and copy its **User UID** (it looks like
   `3f2b1c9e-....`).
4. Back in **SQL Editor**, run this, with her UID and email in place of the
   examples:

   ```sql
   insert into public.staff (user_id, email, role)
   values ('PASTE-THE-USER-UID-HERE', 'deborah@example.com', 'owner');
   ```

A person who exists in Authentication but has **no row in `staff`** cannot
see anything: the portal signs them straight back out. To add more staff
later, repeat these steps with `'staff'` instead of `'owner'`. To remove
someone, delete their row in `staff` (and their user, if you like).

Also in **Authentication > Sign In / Providers**, under Email, turn
**off** "Allow new users to sign up", so nobody can create an account on
their own. Staff accounts are only ever created by you, as above.

## 4. Add the four environment variables in Vercel

In **Supabase > Project Settings > API** you will find the Project URL and
two keys. In **Vercel > the project > Settings > Environment Variables**,
add:

| Name | Value | Notes |
|---|---|---|
| `SUPABASE_URL` | the Project URL, `https://xxxx.supabase.co` | server only |
| `SUPABASE_SERVICE_ROLE_KEY` | the **service_role** key | server only, **secret** |
| `VITE_SUPABASE_URL` | the same Project URL | used by the /admin page |
| `VITE_SUPABASE_ANON_KEY` | the **anon public** key | used by the /admin page |

Rules that matter:

- The **service_role** key bypasses every security rule. It goes **only** in
  `SUPABASE_SERVICE_ROLE_KEY`. Never put it in a variable that starts with
  `VITE_`, never paste it in code, chat or email.
- The anon key is public by design; the database rules decide what it can do.
- After adding them, **redeploy** (Deployments > the latest > Redeploy). The
  `VITE_` ones are read when the site is built, so a redeploy is required.

From then on every paid order is saved. Orders paid **before** this was set
up are not in the portal; they are still in Stripe and in the order emails.
To bring one in, open it in **Stripe > Developers > Events**, find its
`checkout.session.completed` event and click **Resend**. Saving is safe to
repeat (it never duplicates an order), but the resend also sends the two
order emails again.

## 5. Sign in

Open `https://tippincowgirl.com/admin` and sign in with the email and
password from step 3. On a phone, add it to the home screen for quick
access (Share > Add to Home Screen).

## Demo orders (optional, for trying it out)

Six made up orders, one in each status, with real hats from the catalog.
Their emails end in `@demo.tippin`, so they are easy to tell apart.

Use this on a **test** project, not the live one. It needs a `.env` file in
the repository folder with:

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=the service_role key
```

(`.env` is never committed.) Then, on your computer:

```
npm run seed:demo
```

To remove them again, either run:

```
npm run seed:demo:delete
```

or paste this one line in the Supabase SQL Editor:

```sql
delete from public.orders where customer_email like '%@demo.tippin';
```

Their history goes with them. The script refuses to run when `NODE_ENV` is
`production`.

## What is protected, and how

- **Row Level Security is on** for `orders`, `order_events` and `staff`.
- Only signed in users with a row in `staff` can read orders and their
  history.
- Staff can change only three things on an order: its status, its tracking
  number and its internal notes. Moving to Shipped needs a tracking number.
- Nobody can create or delete an order from the browser. Orders are only
  created by the Stripe webhook on the server, with the service role key.
- Prices are never taken from the browser: the totals saved are what Stripe
  charged, and each hat's price is recomputed from the catalog.
