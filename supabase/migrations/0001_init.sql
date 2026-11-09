-- CraftMe core schema for Supabase Postgres. Ported from the Firestore model in docs/SYSTEM_DESIGN.md section 3.
-- Rules this file enforces in the database, so no client or bug can break them:
--   * money is whole paise (bigint), commission is basis points
--   * stock, held and refunds never go negative or past their limits
--   * an Original has stock 0 or 1
--   * clients never write money, stage, stock, role or secret columns (no grants, so RLS cannot be bypassed by a policy typo)
-- Apply in the Supabase SQL Editor, or `supabase db push`. New tables are NOT exposed automatically: every grant is explicit.

-- ---------- helpers: roles live in app_metadata, which only the server can set ----------
create or replace function public.is_admin() returns boolean language sql stable as
$$ select coalesce((auth.jwt() -> 'app_metadata' ->> 'admin')::boolean, false) $$;

create or replace function public.is_artist() returns boolean language sql stable as
$$ select coalesce((auth.jwt() -> 'app_metadata' ->> 'artist')::boolean, false) $$;

-- ---------- profiles (public) and artist_private (owner + admin) ----------
create table public.profiles (
  id uuid primary key default gen_random_uuid(),         -- = auth.users.id for real people; random for demo artists
  display_name text not null default '' check (char_length(display_name) <= 100),
  photo_url text not null default '',
  bio text not null default '' check (char_length(bio) <= 500),
  instagram_handle text not null default '' check (instagram_handle ~ '^[A-Za-z0-9._]{0,30}$'),
  roles text[] not null default '{}',
  restricted boolean not null default false,
  rating_sum integer not null default 0,
  rating_count integer not null default 0,
  rating_avg numeric(3,2) not null default 0,
  showcase jsonb not null default '[]',
  demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.artist_private (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  legal_name text, pan text, payout_method jsonb, phone_verified boolean not null default false,
  verified_at timestamptz,
  onboarding_order_id text unique, onboarding_amount bigint, onboarding_paid_at timestamptz, onboarding_payment_id text,
  amount_owed bigint not null default 0 check (amount_owed >= 0),
  restriction_reasons text[] not null default '{}'
);

-- A new sign-in gets a profile with the same id.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, photo_url)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
          coalesce(new.raw_user_meta_data ->> 'avatar_url', ''))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ---------- artworks and listings ----------
create table public.artworks (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.profiles(id),
  title text not null check (char_length(title) between 1 and 100),
  title_lower text generated always as (lower(title)) stored,
  description text not null default '' check (char_length(description) <= 1000),
  category text not null check (category in ('Painting','Drawing','Textile','Metalwork','Woodwork','Sculpture','Photography','Print','Gifts','Digital')),
  photos text[] not null default '{}' check (cardinality(photos) <= 5),
  video text,
  status text not null default 'draft' check (status in ('draft','published','removed')),
  has_sales boolean not null default false,
  views integer not null default 0,
  from_price_paise bigint check (from_price_paise >= 0),
  available boolean not null default false,
  artist_open boolean not null default true,
  demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index artworks_browse on public.artworks (created_at desc) where status = 'published' and artist_open;
create index artworks_by_artist on public.artworks (artist_id, created_at desc) where status = 'published' and artist_open;
create index artworks_category on public.artworks (category, created_at desc) where status = 'published' and artist_open;

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  artwork_id uuid not null references public.artworks(id) on delete cascade,
  artist_id uuid not null references public.profiles(id),
  title text not null default '',
  kind text not null check (kind in ('original','print')),
  size text not null default '',
  medium text not null default '',
  price bigint not null check (price >= 100),
  stock integer not null default 1 check (stock >= 0),
  held integer not null default 0 check (held >= 0),
  status text not null default 'draft' check (status in ('draft','live','sold','ended')),
  artist_open boolean not null default true,
  demo boolean not null default false,
  created_at timestamptz not null default now(),
  check (held <= stock),                      -- reservable quantity is never negative
  check (kind <> 'original' or stock <= 1)    -- an Original is 0 or 1
);
create index listings_by_artwork on public.listings (artwork_id);

-- ---------- orders ----------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  code text not null,                                           -- short display code, never a key
  buyer_id uuid not null references public.profiles(id),
  artist_id uuid not null references public.profiles(id),
  total bigint not null check (total >= 0),
  stage text not null check (stage in ('hold','hold_expired','paid','shipped','received','refunded')),
  hold_until timestamptz,
  created_at timestamptz not null default now(),
  paid_at timestamptz, ship_by timestamptz, shipped_at timestamptz, auto_receive_at timestamptz,
  received_at timestamptz, damage_window_ends timestamptz, review_by timestamptz,
  gateway_fee bigint not null default 0 check (gateway_fee >= 0),
  commission_bps integer check (commission_bps between 0 and 10000),
  refunded_total bigint not null default 0 check (refunded_total between 0 and total),
  payable boolean not null default false,
  payout_id uuid,
  open_report boolean not null default false,
  damage_reported boolean not null default false,
  reviewed boolean not null default false,
  reminded boolean not null default false,
  overdue boolean not null default false,
  razorpay_order_id text unique,
  razorpay_payment_id text unique,
  courier text, tracking_number text, refund_reason text,
  check (buyer_id <> artist_id)                                 -- a Buyer cannot buy their own work
);
create index orders_by_buyer on public.orders (buyer_id, created_at desc);
create index orders_by_artist on public.orders (artist_id, created_at desc);
create index orders_open_holds on public.orders (hold_until) where stage = 'hold';
create index orders_payable on public.orders (artist_id) where payable and payout_id is null;

create table public.order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  listing_id uuid not null references public.listings(id),
  artwork_id uuid not null references public.artworks(id),
  title text not null default '', kind text not null,
  unit_paise bigint not null check (unit_paise >= 0),
  quantity integer not null check (quantity between 1 and 10),
  refunded_quantity integer not null default 0,
  check (refunded_quantity between 0 and quantity),
  unique (order_id, listing_id)
);

create table public.order_shipping (
  order_id uuid primary key references public.orders(id) on delete cascade,
  name text not null, phone text not null check (phone ~ '^[6-9][0-9]{9}$'),
  address text not null, city text not null, state text not null, pin text not null check (pin ~ '^[0-9]{6}$')
);

create table public.damage_reports (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id), buyer_id uuid not null, artist_id uuid not null,
  photos text[] not null default '{}', note text not null default '',
  status text not null default 'open' check (status in ('open','upheld','rejected')),
  decision text, created_at timestamptz not null default now()
);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id), buyer_id uuid not null, artist_id uuid not null,
  amount bigint not null check (amount > 0), reason text not null,
  lines jsonb not null default '[]', razorpay_refund_id text unique,
  after_payout boolean not null default false, created_at timestamptz not null default now()
);

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.profiles(id),
  run_date date not null, order_ids uuid[] not null default '{}',
  gross bigint not null, refunds bigint not null default 0, commission bigint not null,
  gateway_fees bigint not null default 0, owed_deducted bigint not null default 0,
  net bigint not null check (net >= 0),
  method text, reference text,
  status text not null default 'draft' check (status in ('draft','sent')),
  created_at timestamptz not null default now(),
  unique (artist_id, run_date)
);
alter table public.orders add constraint orders_payout_fk foreign key (payout_id) references public.payouts(id);

create table public.reviews (
  order_id uuid primary key references public.orders(id),         -- one Review per Order
  artist_id uuid not null references public.profiles(id), buyer_id uuid not null references public.profiles(id),
  rating smallint not null check (rating between 1 and 5), comment text not null default '' check (char_length(comment) <= 1000),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null, data jsonb not null default '{}', read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_by_user on public.notifications (user_id, created_at desc);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('artwork','artist')), target_id uuid not null,
  reporter_id uuid references public.profiles(id), reason text not null,
  status text not null default 'open' check (status in ('open','resolved')),
  created_at timestamptz not null default now()
);

-- one row: commission, onboarding fee and the public feature switches
create table public.settings (
  id boolean primary key default true check (id),
  commission_bps integer not null default 1000 check (commission_bps between 0 and 10000),
  onboarding_fee_paise bigint not null default 0 check (onboarding_fee_paise >= 0),
  switches jsonb not null default '{}'
);
insert into public.settings default values;

-- system tables: idempotency and webhook de-duplication. No client access at all.
create table public.requests (
  user_id uuid not null, request_id text not null, state text not null default 'pending' check (state in ('pending','done')), result jsonb, created_at timestamptz not null default now(),
  primary key (user_id, request_id)
);
create table public.processed_events (event_id text primary key, handled_at timestamptz not null default now());

-- ---------- row level security ----------
alter table public.profiles enable row level security;
alter table public.artist_private enable row level security;
alter table public.artworks enable row level security;
alter table public.listings enable row level security;
alter table public.orders enable row level security;
alter table public.order_lines enable row level security;
alter table public.order_shipping enable row level security;
alter table public.damage_reports enable row level security;
alter table public.refunds enable row level security;
alter table public.payouts enable row level security;
alter table public.reviews enable row level security;
alter table public.notifications enable row level security;
alter table public.reports enable row level security;
alter table public.settings enable row level security;
alter table public.requests enable row level security;       -- no policies: only the service role reaches it
alter table public.processed_events enable row level security;

create policy profiles_read on public.profiles for select using (true);
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy artist_private_read on public.artist_private for select to authenticated
  using (profile_id = auth.uid() or public.is_admin());

create policy artworks_read on public.artworks for select using (
  (status = 'published' and artist_open) or artist_id = auth.uid() or public.is_admin());
create policy artworks_insert on public.artworks for insert to authenticated
  with check (public.is_artist() and artist_id = auth.uid() and status = 'draft'
    and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.restricted));
create policy artworks_update on public.artworks for update to authenticated
  using (public.is_artist() and artist_id = auth.uid() and artist_open and status <> 'removed')
  with check (artist_id = auth.uid() and status in ('draft','published'));

create policy listings_read on public.listings for select using (
  (status in ('live','sold') and artist_open) or artist_id = auth.uid() or public.is_admin());
create policy listings_insert on public.listings for insert to authenticated
  with check (public.is_artist() and artist_id = auth.uid() and status = 'draft' and stock >= 1
    and exists (select 1 from public.artworks a where a.id = artwork_id and a.artist_id = auth.uid())  -- only on your own artwork
    and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.restricted));
create policy listings_update on public.listings for update to authenticated
  using (public.is_artist() and artist_id = auth.uid() and artist_open and status <> 'sold')
  with check (artist_id = auth.uid() and status in ('draft','live','ended'));

create policy orders_read on public.orders for select to authenticated
  using (buyer_id = auth.uid() or artist_id = auth.uid() or public.is_admin());
create policy order_lines_read on public.order_lines for select to authenticated using (
  exists (select 1 from public.orders o where o.id = order_id and (o.buyer_id = auth.uid() or o.artist_id = auth.uid() or public.is_admin())));
create policy order_shipping_read on public.order_shipping for select to authenticated using (
  exists (select 1 from public.orders o where o.id = order_id and (
    o.buyer_id = auth.uid() or public.is_admin() or (o.artist_id = auth.uid() and o.stage in ('paid','shipped','received')))));

create policy damage_reports_read on public.damage_reports for select to authenticated
  using (buyer_id = auth.uid() or artist_id = auth.uid() or public.is_admin());
create policy refunds_read on public.refunds for select to authenticated
  using (buyer_id = auth.uid() or artist_id = auth.uid() or public.is_admin());
create policy payouts_read on public.payouts for select to authenticated
  using (artist_id = auth.uid() or public.is_admin());
create policy reviews_read on public.reviews for select using (
  status = 'approved' or buyer_id = auth.uid() or artist_id = auth.uid() or public.is_admin());
create policy notifications_read on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_mark_read on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and read);
create policy reports_read on public.reports for select to authenticated using (public.is_admin());
create policy settings_read on public.settings for select using (true);

-- ---------- grants: explicit, narrow, per column where the client may write ----------
revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to anon, authenticated;

grant select on public.profiles, public.artworks, public.listings, public.reviews to anon, authenticated;
grant select (id, switches) on public.settings to anon, authenticated;   -- the commission and fee stay hidden
grant select on public.artist_private, public.orders, public.order_lines, public.order_shipping,
  public.damage_reports, public.refunds, public.payouts, public.notifications, public.reports to authenticated;

grant update (display_name, photo_url, bio, instagram_handle) on public.profiles to authenticated;
grant insert (artist_id, title, description, category, photos, video, status) on public.artworks to authenticated;
grant update (title, description, category, photos, video, status) on public.artworks to authenticated;
grant insert (artwork_id, artist_id, title, kind, size, medium, price, stock, status) on public.listings to authenticated;
grant update (title, size, medium, price, status) on public.listings to authenticated;
grant update (read) on public.notifications to authenticated;

grant all on all tables in schema public to service_role;
