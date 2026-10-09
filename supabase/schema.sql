-- ---------------------------------------------------------------------------
-- Tippin' Cowgirl staff portal, phase 1: orders.
--
-- Paste this whole file into Supabase > SQL Editor > New query and Run. It
-- is safe to run again: every statement checks whether its object exists.
--
-- Who can do what:
--
--   the Stripe webhook   inserts orders, with the SERVICE ROLE key, which
--                        bypasses Row Level Security. Server only.
--   staff (signed in,    read orders and order_events; change status,
--   listed in `staff`)   tracking_number and internal_notes. Nothing else.
--   anyone else          nothing at all, signed in or not.
--
-- Nobody can insert or delete an order, or touch order_events, from the
-- browser. Status changes are recorded in order_events by a trigger, so the
-- history cannot be skipped.
-- ---------------------------------------------------------------------------

-- ---- tables -----------------------------------------------------------------

create table if not exists public.orders (
  id                uuid primary key default gen_random_uuid(),
  stripe_session_id text not null unique,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  customer_name     text,
  customer_email    text,
  shipping_address  jsonb,
  -- money as Stripe charged it, integer cents
  subtotal          integer not null default 0,
  shipping          integer not null default 0,
  total             integer not null default 0,
  currency          text not null default 'usd',
  status            text not null default 'new'
                    check (status in ('new', 'in_production', 'ready', 'shipped', 'delivered', 'cancelled')),
  tracking_number   text,
  -- every hat as ordered: type, color, size, quantity, accessories,
  -- engraving, and the config and layer ids that redraw its preview
  hats              jsonb not null default '[]'::jsonb,
  hat_count         integer not null default 0,
  internal_notes    text
);

create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_customer_email_idx on public.orders (lower(customer_email));

create table if not exists public.order_events (
  id          bigint generated always as identity primary key,
  order_id    uuid not null references public.orders (id) on delete cascade,
  created_at  timestamptz not null default now(),
  actor_email text,
  from_status text,
  to_status   text,
  note        text
);

create index if not exists order_events_order_idx on public.order_events (order_id, created_at);

create table if not exists public.staff (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email   text not null,
  role    text not null default 'staff' check (role in ('owner', 'staff'))
);

-- ---- who is staff ---------------------------------------------------------------
-- SECURITY DEFINER so the policies below can ask without being blocked by
-- the staff table's own policy.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.staff where user_id = auth.uid());
$$;

-- ---- Row Level Security ---------------------------------------------------------

alter table public.orders enable row level security;
alter table public.order_events enable row level security;
alter table public.staff enable row level security;

drop policy if exists "staff read orders" on public.orders;
create policy "staff read orders" on public.orders
  for select to authenticated using (public.is_staff());

drop policy if exists "staff update orders" on public.orders;
create policy "staff update orders" on public.orders
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "staff read order events" on public.order_events;
create policy "staff read order events" on public.order_events
  for select to authenticated using (public.is_staff());

-- each person can see their own staff row (the portal checks it at sign in)
drop policy if exists "read own staff row" on public.staff;
create policy "read own staff row" on public.staff
  for select to authenticated using (user_id = auth.uid());

-- No insert or delete policy exists on any table, so RLS refuses both for
-- every browser session. The grants below say the same thing a second time,
-- and narrow updates on orders to the three columns staff may change.
revoke all on public.orders, public.order_events, public.staff from anon;
revoke insert, update, delete, truncate on public.orders from authenticated;
revoke insert, update, delete, truncate on public.order_events from authenticated;
revoke insert, update, delete, truncate on public.staff from authenticated;
grant select on public.orders, public.order_events, public.staff to authenticated;
grant update (status, tracking_number, internal_notes) on public.orders to authenticated;

-- ---- history: every status change lands in order_events --------------------------

create or replace function public.orders_before_update()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists orders_before_update on public.orders;
create trigger orders_before_update
  before update on public.orders
  for each row execute function public.orders_before_update();

create or replace function public.orders_log_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    insert into public.order_events (order_id, actor_email, from_status, to_status, note)
    values (
      new.id,
      coalesce(auth.jwt() ->> 'email', 'system'),
      old.status,
      new.status,
      nullif(current_setting('app.status_note', true), '')
    );
  end if;
  return new;
end;
$$;

drop trigger if exists orders_log_status on public.orders;
create trigger orders_log_status
  after update of status on public.orders
  for each row execute function public.orders_log_status();

-- ---- the one way the portal changes a status ---------------------------------------
-- Staff only. Moving to shipped needs a tracking number (passed here or
-- already on the order). The optional note is stored on the history row.
create or replace function public.staff_set_order_status(
  p_order_id uuid,
  p_status text,
  p_tracking_number text default null,
  p_note text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.orders;
  tracking text := nullif(btrim(coalesce(p_tracking_number, '')), '');
begin
  if not public.is_staff() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_status not in ('new', 'in_production', 'ready', 'shipped', 'delivered', 'cancelled') then
    raise exception 'Unknown status %', p_status using errcode = '22023';
  end if;
  if p_status = 'shipped'
     and tracking is null
     and not exists (select 1 from public.orders where id = p_order_id and nullif(btrim(coalesce(tracking_number, '')), '') is not null) then
    raise exception 'A tracking number is required to mark an order shipped' using errcode = '22023';
  end if;

  perform set_config('app.status_note', coalesce(left(p_note, 500), ''), true);
  update public.orders
     set status = p_status,
         tracking_number = coalesce(tracking, tracking_number)
   where id = p_order_id
  returning * into result;
  perform set_config('app.status_note', '', true);

  if result.id is null then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
  return result;
end;
$$;

revoke all on function public.staff_set_order_status(uuid, text, text, text) from public, anon;
grant execute on function public.staff_set_order_status(uuid, text, text, text) to authenticated;
revoke all on function public.is_staff() from public, anon;
grant execute on function public.is_staff() to authenticated;

-- ===========================================================================
-- Phase 2: booking requests (the "Book the bar" form).
--
-- Safe to run on top of everything above, and again later. Same rules as
-- orders: the website's server inserts with the SERVICE ROLE key (and the
-- import script, from a computer); staff read, and change only status,
-- proposed_date and internal_notes; nobody inserts or deletes from the
-- browser; every status change lands in booking_events.
-- ===========================================================================

create table if not exists public.bookings (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  name           text not null,
  email          text,
  phone          text,
  event_type     text,
  event_date     date,
  notes          text,
  status         text not null default 'new'
                 check (status in ('new', 'confirmed', 'declined', 'rescheduled', 'completed')),
  -- the new date offered when rescheduling
  proposed_date  date,
  internal_notes text,
  source         text not null default 'website'
);

create index if not exists bookings_created_at_idx on public.bookings (created_at desc);
create index if not exists bookings_status_idx on public.bookings (status);
create index if not exists bookings_event_date_idx on public.bookings (event_date);
create index if not exists bookings_email_idx on public.bookings (lower(email));

create table if not exists public.booking_events (
  id          bigint generated always as identity primary key,
  booking_id  uuid not null references public.bookings (id) on delete cascade,
  created_at  timestamptz not null default now(),
  actor_email text,
  from_status text,
  to_status   text,
  note        text
);

create index if not exists booking_events_booking_idx on public.booking_events (booking_id, created_at);

-- ---- Row Level Security -----------------------------------------------------------

alter table public.bookings enable row level security;
alter table public.booking_events enable row level security;

drop policy if exists "staff read bookings" on public.bookings;
create policy "staff read bookings" on public.bookings
  for select to authenticated using (public.is_staff());

drop policy if exists "staff update bookings" on public.bookings;
create policy "staff update bookings" on public.bookings
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "staff read booking events" on public.booking_events;
create policy "staff read booking events" on public.booking_events
  for select to authenticated using (public.is_staff());

-- No insert or delete policy: RLS refuses both for every browser session.
-- The grants say it again and narrow staff updates to three columns.
revoke all on public.bookings, public.booking_events from anon;
revoke insert, update, delete, truncate on public.bookings from authenticated;
revoke insert, update, delete, truncate on public.booking_events from authenticated;
grant select on public.bookings, public.booking_events to authenticated;
grant update (status, proposed_date, internal_notes) on public.bookings to authenticated;

-- ---- updated_at and history ------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists bookings_before_update on public.bookings;
create trigger bookings_before_update
  before update on public.bookings
  for each row execute function public.set_updated_at();

create or replace function public.bookings_log_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    insert into public.booking_events (booking_id, actor_email, from_status, to_status, note)
    values (
      new.id,
      coalesce(auth.jwt() ->> 'email', 'system'),
      old.status,
      new.status,
      nullif(current_setting('app.status_note', true), '')
    );
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_log_status on public.bookings;
create trigger bookings_log_status
  after update of status on public.bookings
  for each row execute function public.bookings_log_status();

-- ---- the one way the portal changes a booking's status --------------------------------
-- Staff only. Rescheduled needs a proposed date (passed here or already on
-- the booking); without a note, the history row records that date.
create or replace function public.staff_set_booking_status(
  p_booking_id uuid,
  p_status text,
  p_proposed_date date default null,
  p_note text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.bookings;
  current_proposed date;
begin
  if not public.is_staff() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_status not in ('new', 'confirmed', 'declined', 'rescheduled', 'completed') then
    raise exception 'Unknown status %', p_status using errcode = '22023';
  end if;
  select proposed_date into current_proposed from public.bookings where id = p_booking_id;
  if p_status = 'rescheduled' and p_proposed_date is null and current_proposed is null then
    raise exception 'A proposed date is required to mark a booking rescheduled' using errcode = '22023';
  end if;

  perform set_config(
    'app.status_note',
    coalesce(
      left(nullif(btrim(coalesce(p_note, '')), ''), 500),
      case when p_status = 'rescheduled' then 'Proposed date: ' || coalesce(p_proposed_date, current_proposed)::text end,
      ''
    ),
    true
  );
  update public.bookings
     set status = p_status,
         proposed_date = coalesce(p_proposed_date, proposed_date)
   where id = p_booking_id
  returning * into result;
  perform set_config('app.status_note', '', true);

  if result.id is null then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;
  return result;
end;
$$;

revoke all on function public.staff_set_booking_status(uuid, text, date, text) from public, anon;
grant execute on function public.staff_set_booking_status(uuid, text, date, text) to authenticated;
