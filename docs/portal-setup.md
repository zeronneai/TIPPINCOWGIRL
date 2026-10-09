# Staff portal setup (orders and bookings)

The portal lives at **/admin** on the site. Staff sign in with an email and
password. A switch at the top moves between the two sections:

- **Orders**: every paid order (newest first), moved through New, In
  production, Ready, Shipped, Delivered or Cancelled.
- **Bookings**: every booking request from the site's form, as a list or a
  month calendar, moved through New, Confirmed, Rescheduled (with a proposed
  date), Declined or Completed. The tab shows how many are still New.

Every change is kept in the order's or booking's history.

Orders get there by themselves: when Stripe confirms a payment, the webhook
that already sends the order emails also saves the order in the database.
Booking requests too: the form still sends each one to the Google Sheet
exactly as before, and also saves a copy in the database. If saving the
copy ever fails, the visitor still sees their request go through and the
Sheet still gets it.

Changing a booking's status **does not email the customer** yet. Reach out
to them yourself for now; the accept, decline and reschedule emails come
later, once their wording is approved.

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

**Already set up the orders portal before bookings existed?** Run
`supabase/schema.sql` again the same way (all of it). It adds the
`bookings` and `booking_events` tables and their rules and leaves orders,
staff and everything else untouched. If you prefer, paste only the part
from the line `-- Phase 2: booking requests` to the end of the file.

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
up are not in the portal yet; bring them all in at once with the backfill
below (it sends no emails). Resending a single event from **Stripe >
Developers > Events** also works, but that one does send the two order
emails again.

## 5. Sign in

Open `https://tippincowgirl.com/admin` and sign in with the email and
password from step 3. On a phone, add it to the home screen for quick
access (Share > Add to Home Screen).

## Bring in older orders (backfill)

A one-off script copies every **paid** Stripe checkout into the portal:
the orders from before the portal existed, or any the webhook could not
store. It builds each order exactly as the webhook does, **sends no
email**, and is safe to run as many times as you like: an order already in
the portal is left exactly as it is, status, tracking number and notes
included.

1. On your computer, in the repository folder, create a file named `.env`
   (it is never committed) with:

   ```
   STRIPE_SECRET_KEY=sk_live_...
   SUPABASE_URL=https://xxxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=the service_role key
   ```

   Use the **live** Stripe key for real orders (a test key reads test mode
   checkouts).
2. First look without writing anything:

   ```
   npm run backfill:orders -- --dry-run
   ```

   It prints how many orders it would insert and one line for each (date,
   customer, total). Only the Stripe key is needed for this.
3. Then run it for real:

   ```
   npm run backfill:orders
   ```

   It ends with a summary: inserted, already existed, skipped. A checkout
   with missing or unreadable order details (one that did not come from the
   hat builder, for example) is skipped and listed with its session id and
   the reason; the rest still go in.

Backfilled orders start as **New**, with a first history line dated on the
day they were paid ("Paid on Stripe (added by the backfill)"). Move the ones
already delivered to the right status in the portal.

The script never prints your keys. Delete the `.env` file when you are done
if this is a shared computer.

## Bring in older booking requests (from the Google Sheet)

A one-off script copies the requests already in the Google Sheet into the
portal. It sends no email and is safe to run again: a row is skipped when a
booking with the same email, event date and sent time is already there.

1. In the Google Sheet, **File > Download > Comma separated values (.csv)**.
2. In the repository folder, create a folder named `data` and save the file
   in it as `data/bookings.csv`. The `data` folder is never committed (it
   holds customer phone numbers and emails); delete the file when you are
   done.
3. Put `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env` (as for the
   backfill above).
4. First look without writing anything:

   ```
   npm run import:bookings -- --dry-run
   ```

   It lists each row it would insert (sent date, name, event type, event
   date) and each row it cannot read, with its line number and the reason.
5. Then run it for real:

   ```
   npm run import:bookings
   ```

   The last line says how many were inserted and skipped, or the exact
   error.

Good to know:

- The columns are matched by name: `Timestamp`, `name`, `email`, `phone`,
  `eventType`, `eventDate`, `notes`. Empty cells stay empty.
- `Timestamp` is read as day/month/year hour:minute:second, and
  `eventDate` as YYYY-MM-DD. A row with another format, or no name, is
  skipped and listed; the rest still go in.
- The Sheet's times have no time zone, so they are read as Mountain Time
  (El Paso, `America/Denver`). If the Sheet is set to another zone (File >
  Settings), pass it: `npm run import:bookings -- --tz=America/Chicago`.
- A different file: `npm run import:bookings -- path/to/file.csv`.
- Imported requests start as **New**, with source "Imported from the Google
  Sheet" and a first history line dated when they were sent. Move the old
  ones to the right status in the portal.

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

## Demo bookings (optional, for trying it out)

Four made up booking requests, one New, one Confirmed, one Rescheduled
(with a proposed date) and one Declined, dated over the next few weeks so
the calendar has something to show. Their emails end in `@demo.tippin` too.
Same rules as the demo orders: a **test** project, the same `.env`, and it
refuses to run when `NODE_ENV` is `production`.

```
npm run seed:demo-bookings
```

To remove them again, either run:

```
npm run seed:demo-bookings:delete
```

or paste this one line in the Supabase SQL Editor:

```sql
delete from public.bookings where email like '%@demo.tippin';
```

All these scripts (the demo seeds, the backfill and the bookings import)
work the same on Windows,
macOS and Linux. Every run prints what it is about to do on its first line
and the result on its last (how many were added, deleted or skipped, or the
exact error), so a run that prints nothing means it did not start. On
Windows PowerShell, instead of a `.env` file you can set the variables for
the session first:

```
$env:SUPABASE_URL = "https://xxxx.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "the service_role key"
npm run seed:demo
```

Note: the line `.env not found. Continuing without it.` only means there is
no `.env` file; the variables set in the shell are still used.

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
- **Row Level Security is on** for `bookings` and `booking_events` too. Only
  staff can read them, and staff can change only three things on a
  booking: its status, its proposed date and its internal notes. Moving to
  Rescheduled needs a proposed date. Every status change is written to the
  booking's history with who made it and when.
- Nobody can create or delete a booking from the browser. The form's copy
  is saved by the server (`/api/booking`), which checks and trims every
  field, refuses invalid emails and over long text, ignores bots (a hidden
  field people never fill in), and folds a quick resend of the same request
  into one.
