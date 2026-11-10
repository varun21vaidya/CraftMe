-- Business logic as Postgres functions: each is one transaction, so stock, money and stage can never disagree.
-- Ported from functions/src (Firestore). Rules that changed on the way over:
--   * recordPayout recomputes from current orders and refuses a stale draft ("rebuild")
--   * mark_paid treats a refunded order as done (a late webhook cannot refund twice)
--   * a provider error on a refund keeps the reservation as status "unknown" (never undone)
--   * place_order limits open holds under a per-buyer lock (no race)
-- Errors are JSON in the exception message: {"code":..., "reason":...}. The Edge Function and gateway.js parse them.

alter table public.artist_private add column owed_since timestamptz;
alter table public.refunds add column status text not null default 'issued' check (status in ('pending','issued','unknown'));
alter table public.damage_reports add column line_ids uuid[] not null default '{}', add column decided_at timestamptz,
  add column decided_by uuid, add unique (order_id);
alter table public.reviews add column buyer_name text not null default '', add column decided_at timestamptz, add column decided_by uuid;
create index payouts_by_artist_fk on public.payouts (artist_id);
create index orders_by_payout on public.orders (payout_id) where payout_id is not null;

create or replace function public.fail(p_code text, p_reason text default null, p_extra jsonb default '{}')
returns void language plpgsql set search_path = '' as $$
begin
  raise exception '%', (jsonb_build_object('code', p_code, 'reason', p_reason) || p_extra)::text;
end $$;

-- ---------- pure money rules (domain/money.js) ----------
create or replace function public.commission_of(p_net bigint, p_bp integer) returns bigint
language sql immutable set search_path = '' as $$ select (p_net * p_bp) / 10000 $$;

create or replace function public.owed_after_refund(p_price bigint, p_before bigint, p_refund bigint, p_bp integer) returns bigint
language sql immutable set search_path = '' as $$
  select p_refund - (public.commission_of(p_price - p_before, p_bp) - public.commission_of(p_price - p_before - p_refund, p_bp)) $$;

create or replace function public.payout_calc(p_orders uuid[], p_owed bigint)
returns table (gross bigint, refunds bigint, commission bigint, fees bigint, owed_deducted bigint, net bigint, owed_left bigint)
language plpgsql stable set search_path = '' as $$
declare g bigint := 0; r bigint := 0; c bigint := 0; f bigint := 0; sub bigint := 0; o record; k bigint; cm bigint; pay bigint; ded bigint;
begin
  for o in select ord.total, ord.refunded_total, ord.gateway_fee, coalesce(ord.commission_bps, 0) as bp
           from public.orders ord where ord.id = any (p_orders) loop
    k := o.total - o.refunded_total;
    cm := public.commission_of(k, o.bp);
    g := g + o.total; r := r + o.refunded_total; c := c + cm; f := f + o.gateway_fee;
    sub := sub + (k - cm - o.gateway_fee);
  end loop;
  pay := greatest(sub, 0);                -- a negative subtotal pays nothing and grows what is owed
  ded := least(p_owed, pay);
  return query select g, r, c, f, ded, pay - ded, p_owed - ded + greatest(-sub, 0);
end $$;

-- ---------- ordering ----------
create or replace function public.place_order(p_buyer uuid, p_artist uuid, p_lines jsonb, p_address jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_order uuid; v_total bigint := 0; l jsonb; x public.listings%rowtype; qty integer; changed jsonb := '[]';
  v_hold timestamptz := now() + interval '15 minutes'; n integer;
begin
  if p_buyer = p_artist then perform public.fail('conflict', 'own_listing'); end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) not between 1 and 20 then perform public.fail('invalid', null, '{"fields":["lines"]}'); end if;
  if (select count(distinct e ->> 'listingId') from jsonb_array_elements(p_lines) e) <> jsonb_array_length(p_lines) then
    perform public.fail('invalid', 'duplicate listing', '{"fields":["lines"]}');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_buyer::text, 0));   -- one buyer at a time: the holds limit cannot race
  select count(*) into n from public.orders where buyer_id = p_buyer and stage = 'hold' and hold_until > now();
  if n >= 3 then perform public.fail('rate_limited', 'too_many_holds'); end if;

  insert into public.orders (code, buyer_id, artist_id, total, stage, hold_until)
  values (upper(left(replace(gen_random_uuid()::text, '-', ''), 6)), p_buyer, p_artist, 0, 'hold', v_hold) returning id into v_order;

  for l in select e from jsonb_array_elements(p_lines) e order by e ->> 'listingId' loop   -- fixed lock order: no deadlocks
    qty := (l ->> 'quantity')::integer;
    if qty is null or qty not between 1 and 10 then perform public.fail('invalid', null, '{"fields":["lines"]}'); end if;
    select * into x from public.listings where id = (l ->> 'listingId')::uuid for update;
    if not found or x.status <> 'live' then perform public.fail('conflict', 'sold', jsonb_build_object('listingId', l ->> 'listingId')); end if;
    if x.artist_id <> p_artist then perform public.fail('conflict', 'mixed_artists'); end if;
    if not x.artist_open then perform public.fail('conflict', 'artist_restricted'); end if;
    if x.stock - x.held < qty then perform public.fail('conflict', 'sold', jsonb_build_object('listingId', l ->> 'listingId')); end if;
    if l ? 'seenUnitPaise' and (l ->> 'seenUnitPaise')::bigint <> x.price then
      changed := changed || jsonb_build_object('listingId', x.id, 'unitPaise', x.price);
    end if;
    update public.listings set held = held + qty where id = x.id;
    insert into public.order_lines (order_id, listing_id, artwork_id, title, kind, unit_paise, quantity)
    values (v_order, x.id, x.artwork_id, x.title, x.kind, x.price, qty);
    v_total := v_total + x.price * qty;
  end loop;
  if jsonb_array_length(changed) > 0 then perform public.fail('conflict', 'price_changed', jsonb_build_object('changedLines', changed)); end if;

  update public.orders set total = v_total where id = v_order;
  insert into public.order_shipping (order_id, name, phone, address, city, state, pin)
  values (v_order, p_address ->> 'name', p_address ->> 'phone', p_address ->> 'address', p_address ->> 'city', p_address ->> 'state', p_address ->> 'pin');
  return jsonb_build_object('orderId', v_order, 'amount', v_total, 'holdUntil', v_hold);
end $$;

-- Release the stock of a hold. p_force skips the clock check (used when the payment order could not be created).
create or replace function public.expire_hold(p_order uuid, p_force boolean default false) returns boolean
language plpgsql security definer set search_path = '' as $$
declare o public.orders%rowtype; l record;
begin
  select * into o from public.orders where id = p_order for update;
  if not found or o.stage <> 'hold' then return false; end if;
  if not p_force and o.hold_until > now() then return false; end if;
  for l in select listing_id, quantity from public.order_lines where order_id = p_order order by listing_id loop
    update public.listings set held = greatest(held - l.quantity, 0) where id = l.listing_id;
  end loop;
  update public.orders set stage = 'hold_expired' where id = p_order;
  return true;
end $$;

-- A verified payment arrived. Idempotent: a paid, shipped, received or refunded order is returned untouched.
create or replace function public.mark_paid(p_order uuid, p_payment text, p_fee bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare o public.orders%rowtype; was_held boolean; bps integer; l record; short boolean := false;
begin
  select * into o from public.orders where id = p_order for update;
  if not found then perform public.fail('conflict', 'not_found'); end if;
  if o.stage in ('paid', 'shipped', 'received', 'refunded') then return jsonb_build_object('stage', o.stage); end if;
  if o.stage not in ('hold', 'hold_expired') then perform public.fail('conflict', 'wrong_stage'); end if;
  was_held := o.stage = 'hold';

  if not was_held then   -- the hold had expired: accept only if the stock is still free
    for l in select ol.quantity, li.stock, li.held from public.order_lines ol join public.listings li on li.id = ol.listing_id
             where ol.order_id = p_order order by li.id for update of li loop
      if l.stock - l.held < l.quantity then short := true; end if;
    end loop;
    if short then return jsonb_build_object('oversold', true); end if;
  end if;

  select coalesce(commission_bps, 1000) into bps from public.settings;
  for l in select listing_id, artwork_id, quantity from public.order_lines where order_id = p_order order by listing_id loop
    update public.listings set stock = stock - l.quantity,
      held = case when was_held then held - l.quantity else held end,
      status = case when stock - l.quantity <= 0 then 'sold' else status end
    where id = l.listing_id;
    update public.artworks set has_sales = true where id = l.artwork_id;
  end loop;
  update public.orders set stage = 'paid', razorpay_payment_id = p_payment, gateway_fee = coalesce(p_fee, 0), commission_bps = bps,
    paid_at = now(), ship_by = now() + interval '7 days', reminded = false, overdue = false where id = p_order;
  return jsonb_build_object('stage', 'paid');
end $$;

-- Sold to someone else while this payment was in flight: the only automatic refund. Called after the provider refund succeeded.
create or replace function public.refund_oversold(p_order uuid, p_payment text, p_refund_id text) returns void
language plpgsql security definer set search_path = '' as $$
declare o public.orders%rowtype;
begin
  select * into o from public.orders where id = p_order for update;
  if not found or o.stage <> 'hold_expired' then return; end if;
  insert into public.refunds (order_id, buyer_id, artist_id, amount, reason, lines, razorpay_refund_id, after_payout, status)
  select p_order, o.buyer_id, o.artist_id, o.total, 'sold_during_payment',
    coalesce(jsonb_agg(jsonb_build_object('lineId', listing_id, 'quantity', quantity, 'amount', unit_paise * quantity)), '[]'),
    p_refund_id, false, 'issued' from public.order_lines where order_id = p_order;
  update public.order_lines set refunded_quantity = quantity where order_id = p_order;
  update public.orders set stage = 'refunded', razorpay_payment_id = p_payment, refunded_total = total, refund_reason = 'sold_during_payment'
  where id = p_order;
end $$;

-- ---------- fulfilment (called by the signed-in user; ownership is checked inside) ----------
create or replace function public.mark_shipped(p_order uuid, p_courier text, p_tracking text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare o public.orders%rowtype;
begin
  if btrim(coalesce(p_courier, '')) = '' then perform public.fail('invalid', null, '{"fields":["courier"]}'); end if;
  select * into o from public.orders where id = p_order for update;
  if not found then perform public.fail('conflict', 'not_found'); end if;
  if o.artist_id is distinct from auth.uid() then perform public.fail('forbidden'); end if;
  if o.stage <> 'paid' then perform public.fail('conflict', 'wrong_stage'); end if;
  update public.orders set stage = 'shipped', shipped_at = now(), auto_receive_at = now() + interval '14 days',
    courier = left(btrim(p_courier), 60), tracking_number = left(btrim(coalesce(p_tracking, '')), 60) where id = p_order;
  return jsonb_build_object('stage', 'shipped');
end $$;

create or replace function public._set_received(p_order uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r timestamptz;
begin
  update public.orders set stage = 'received', received_at = now(), damage_window_ends = now() + interval '3 days',
    review_by = now() + interval '30 days', payable = false, open_report = false, damage_reported = false, reviewed = false
  where id = p_order returning review_by into r;
  return jsonb_build_object('stage', 'received', 'reviewBy', r);
end $$;

create or replace function public.confirm_received(p_order uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare o public.orders%rowtype;
begin
  select * into o from public.orders where id = p_order for update;
  if not found then perform public.fail('conflict', 'not_found'); end if;
  if o.buyer_id is distinct from auth.uid() then perform public.fail('forbidden'); end if;
  if o.stage <> 'shipped' then perform public.fail('conflict', 'wrong_stage'); end if;
  return public._set_received(p_order);
end $$;

-- ---------- trust: damage, reviews, reports ----------
create or replace function public.report_damage(p_order uuid, p_line_ids uuid[], p_note text, p_photos text[] default '{}') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare o public.orders%rowtype; uid uuid := auth.uid(); p text;
begin
  if coalesce(array_length(p_line_ids, 1), 0) = 0 or btrim(coalesce(p_note, '')) = '' or char_length(p_note) > 500 then
    perform public.fail('invalid', null, '{"fields":["note"]}');
  end if;
  foreach p in array coalesce(p_photos, '{}') loop   -- photos must sit in the caller's own folder
    if p not like 'damage/' || uid::text || '/%' then perform public.fail('invalid', null, '{"fields":["photoPaths"]}'); end if;
  end loop;
  select * into o from public.orders where id = p_order for update;
  if not found then perform public.fail('conflict', 'not_found'); end if;
  if o.buyer_id is distinct from uid then perform public.fail('forbidden'); end if;
  if o.stage <> 'received' then perform public.fail('conflict', 'wrong_stage'); end if;
  if o.damage_reported or o.open_report then perform public.fail('conflict', 'already_exists'); end if;
  if now() > o.damage_window_ends then perform public.fail('conflict', 'window_closed'); end if;
  if exists (select 1 from unnest(p_line_ids) id where id not in (select listing_id from public.order_lines where order_id = p_order)) then
    perform public.fail('invalid', null, '{"fields":["lineIds"]}');
  end if;
  insert into public.damage_reports (order_id, buyer_id, artist_id, line_ids, photos, note) values (p_order, uid, o.artist_id, p_line_ids, p_photos, btrim(p_note));
  update public.orders set open_report = true, damage_reported = true where id = p_order;
  return jsonb_build_object('reportId', p_order);
end $$;

create or replace function public.decide_damage(p_order uuid, p_decision text, p_note text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.damage_reports%rowtype;
begin
  if not public.is_admin() then perform public.fail('forbidden'); end if;
  if p_decision not in ('upheld', 'rejected') then perform public.fail('invalid', null, '{"fields":["decision"]}'); end if;
  select * into r from public.damage_reports where order_id = p_order for update;
  if not found then perform public.fail('conflict', 'not_found'); end if;
  if r.status <> 'open' then perform public.fail('conflict', 'already_decided'); end if;
  update public.damage_reports set status = p_decision, decision = left(coalesce(p_note, ''), 500), decided_at = now(), decided_by = auth.uid() where id = r.id;
  update public.orders set open_report = false where id = p_order;
  return jsonb_build_object('status', p_decision);
end $$;

create or replace function public.submit_review(p_order uuid, p_rating integer, p_comment text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare o public.orders%rowtype; uid uuid := auth.uid(); nm text;
begin
  if p_rating is null or p_rating not between 1 and 5 or btrim(coalesce(p_comment, '')) = '' or char_length(p_comment) > 500 then
    perform public.fail('invalid', null, '{"fields":["rating","comment"]}');
  end if;
  select * into o from public.orders where id = p_order for update;
  if not found then perform public.fail('conflict', 'not_found'); end if;
  if o.buyer_id is distinct from uid then perform public.fail('forbidden'); end if;
  if o.stage <> 'received' then perform public.fail('conflict', 'wrong_stage'); end if;
  if o.reviewed then perform public.fail('conflict', 'already_exists'); end if;
  if now() > o.review_by then perform public.fail('conflict', 'window_closed'); end if;
  select coalesce(nullif(split_part(btrim(display_name), ' ', 1), ''), 'Buyer') into nm from public.profiles where id = uid;
  insert into public.reviews (order_id, artist_id, buyer_id, rating, comment, buyer_name) values (p_order, o.artist_id, uid, p_rating, btrim(p_comment), coalesce(nm, 'Buyer'));
  update public.orders set reviewed = true where id = p_order;
  return jsonb_build_object('reviewId', p_order);
end $$;

create or replace function public.decide_review(p_order uuid, p_decision text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.reviews%rowtype; cnt integer; sm integer;
begin
  if not public.is_admin() then perform public.fail('forbidden'); end if;
  if p_decision not in ('approved', 'rejected') then perform public.fail('invalid', null, '{"fields":["decision"]}'); end if;
  select * into r from public.reviews where order_id = p_order for update;
  if not found then perform public.fail('conflict', 'not_found'); end if;
  if r.status <> 'pending' then perform public.fail('conflict', 'already_decided'); end if;
  update public.reviews set status = p_decision, decided_at = now(), decided_by = auth.uid() where order_id = p_order;
  if p_decision = 'approved' then   -- a rejection never touches the average
    update public.profiles set rating_count = rating_count + 1, rating_sum = rating_sum + r.rating,
      rating_avg = round(((rating_sum + r.rating)::numeric / (rating_count + 1)), 2) where id = r.artist_id;
  end if;
  return jsonb_build_object('status', p_decision);
end $$;

create or replace function public.report(p_target_type text, p_target uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare rid uuid;
begin
  if auth.uid() is null then perform public.fail('forbidden'); end if;
  if p_target_type not in ('artwork', 'artist') or btrim(coalesce(p_reason, '')) = '' or char_length(p_reason) > 500 then
    perform public.fail('invalid', null, '{"fields":["reason"]}');
  end if;
  insert into public.reports (target_type, target_id, reporter_id, reason) values (p_target_type, p_target, auth.uid(), btrim(p_reason)) returning id into rid;
  return jsonb_build_object('reportId', rid);
end $$;

-- ---------- refunds: reserve in the database first, then the provider, then confirm ----------
create or replace function public.reserve_refund(p_order uuid, p_lines jsonb, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  o public.orders%rowtype; r jsonb; ol public.order_lines%rowtype; q integer; v_amount bigint := 0; v_lines jsonb := '[]';
  v_delta bigint := 0; v_refund uuid; v_fully boolean; was bigint;
begin
  if btrim(coalesce(p_reason, '')) = '' or char_length(p_reason) > 300 then perform public.fail('invalid', null, '{"fields":["reason"]}'); end if;
  select * into o from public.orders where id = p_order for update;
  if not found then perform public.fail('conflict', 'not_found'); end if;
  if o.stage not in ('paid', 'shipped', 'received') then perform public.fail('conflict', 'wrong_stage'); end if;
  for r in select e from jsonb_array_elements(p_lines) e loop
    q := (r ->> 'quantity')::integer;
    select * into ol from public.order_lines where order_id = p_order and listing_id = (r ->> 'lineId')::uuid for update;
    if not found or q is null or q < 1 or q > ol.quantity - ol.refunded_quantity then perform public.fail('conflict', 'exceeds_paid'); end if;
    update public.order_lines set refunded_quantity = refunded_quantity + q where id = ol.id;
    v_amount := v_amount + ol.unit_paise * q;
    v_lines := v_lines || jsonb_build_object('lineId', ol.listing_id, 'quantity', q, 'amount', ol.unit_paise * q);
  end loop;
  if v_amount <= 0 or o.refunded_total + v_amount > o.total then perform public.fail('conflict', 'exceeds_paid'); end if;

  if o.payout_id is not null then   -- the Artist was already paid: the refund becomes an amount owed
    v_delta := public.owed_after_refund(o.total, o.refunded_total, v_amount, coalesce(o.commission_bps, 0));
    select amount_owed into was from public.artist_private where profile_id = o.artist_id for update;
    update public.artist_private set amount_owed = amount_owed + v_delta, owed_since = case when coalesce(was, 0) = 0 then now() else owed_since end
    where profile_id = o.artist_id;
  end if;
  select not exists (select 1 from public.order_lines where order_id = p_order and refunded_quantity < quantity) into v_fully;
  update public.orders set refunded_total = refunded_total + v_amount, stage = case when v_fully then 'refunded' else stage end where id = p_order;
  insert into public.refunds (order_id, buyer_id, artist_id, amount, reason, lines, after_payout, status)
  values (p_order, o.buyer_id, o.artist_id, v_amount, btrim(p_reason), v_lines, o.payout_id is not null, 'pending') returning id into v_refund;
  return jsonb_build_object('refundId', v_refund, 'amount', v_amount, 'paymentId', o.razorpay_payment_id);
end $$;

create or replace function public.confirm_refund(p_refund uuid, p_rz text) returns void
language sql security definer set search_path = '' as $$
  update public.refunds set razorpay_refund_id = p_rz, status = 'issued' where id = p_refund $$;

-- The provider call failed or timed out: it may still have refunded, so keep the reservation and let the Admin check.
create or replace function public.mark_refund_unknown(p_refund uuid) returns void
language sql security definer set search_path = '' as $$
  update public.refunds set status = 'unknown' where id = p_refund and status = 'pending' $$;

-- ---------- payouts ----------
create or replace function public._build_payout_run() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a record; priv public.artist_private%rowtype; run record; ids uuid[]; created uuid[] := '{}'; blocked uuid[] := '{}'; pid uuid;
  v_day date := (now() at time zone 'Asia/Kolkata')::date;
begin
  for a in select artist_id, array_agg(id order by created_at) as order_ids
           from (select id, artist_id, created_at from public.orders where payable and payout_id is null order by created_at limit 500) t
           group by artist_id loop
    select * into priv from public.artist_private where profile_id = a.artist_id;
    if not found or priv.verified_at is null then blocked := blocked || a.artist_id; continue; end if;
    if exists (select 1 from public.payouts where artist_id = a.artist_id and run_date = v_day and status = 'sent') then continue; end if;
    select * into run from public.payout_calc(a.order_ids, priv.amount_owed);
    insert into public.payouts (artist_id, run_date, order_ids, gross, refunds, commission, gateway_fees, owed_deducted, net, method, status)
    values (a.artist_id, v_day, a.order_ids, run.gross, run.refunds, run.commission, run.fees, run.owed_deducted, run.net, priv.payout_method ->> 'type', 'draft')
    on conflict (artist_id, run_date) do update set order_ids = excluded.order_ids, gross = excluded.gross, refunds = excluded.refunds,
      commission = excluded.commission, gateway_fees = excluded.gateway_fees, owed_deducted = excluded.owed_deducted, net = excluded.net,
      method = excluded.method where public.payouts.status = 'draft'
    returning id into pid;
    created := created || pid;
  end loop;
  return jsonb_build_object('created', created, 'blocked', blocked);
end $$;

create or replace function public.build_payout_run() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then perform public.fail('forbidden'); end if;
  return public._build_payout_run();
end $$;

-- Marks one Artist's draft as sent. The numbers are recomputed from the orders as they are now: a refund after the
-- draft was built changes them, and then the Admin must rebuild instead of overpaying.
create or replace function public.record_payout(p_payout uuid, p_reference text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare pay public.payouts%rowtype; priv public.artist_private%rowtype; run record; n integer;
begin
  if not public.is_admin() then perform public.fail('forbidden'); end if;
  if btrim(coalesce(p_reference, '')) = '' or char_length(p_reference) > 100 then perform public.fail('invalid', null, '{"fields":["reference"]}'); end if;
  select * into pay from public.payouts where id = p_payout for update;
  if not found then perform public.fail('conflict', 'not_found'); end if;
  if pay.status <> 'draft' then perform public.fail('conflict', 'already_sent'); end if;
  select * into priv from public.artist_private where profile_id = pay.artist_id for update;
  if not found or priv.verified_at is null then perform public.fail('conflict', 'artist_unverified'); end if;
  perform 1 from public.orders where id = any (pay.order_ids) for update;
  select count(*) into n from public.orders where id = any (pay.order_ids) and payout_id is null;
  if n <> coalesce(array_length(pay.order_ids, 1), 0) then perform public.fail('conflict', 'already_sent'); end if;
  select * into run from public.payout_calc(pay.order_ids, priv.amount_owed);
  if run.net <> pay.net then perform public.fail('conflict', 'rebuild'); end if;
  update public.orders set payout_id = p_payout where id = any (pay.order_ids);
  update public.payouts set status = 'sent', reference = btrim(p_reference) where id = p_payout;
  update public.artist_private set amount_owed = run.owed_left, owed_since = case when run.owed_left = 0 then null else owed_since end
  where profile_id = pay.artist_id;
  return jsonb_build_object('status', 'sent');
end $$;

-- ---------- artists ----------
create or replace function public.submit_verification(p_legal_name text, p_pan text, p_method jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); t text := p_method ->> 'type';
begin
  if uid is null then perform public.fail('forbidden'); end if;
  if btrim(coalesce(p_legal_name, '')) = '' or char_length(p_legal_name) > 100 then perform public.fail('invalid', null, '{"fields":["legalName"]}'); end if;
  if p_pan !~ '^[A-Z]{5}[0-9]{4}[A-Z]$' then perform public.fail('invalid', null, '{"fields":["pan"]}'); end if;
  if t = 'upi' then
    if coalesce(p_method ->> 'upi', '') !~ '^[A-Za-z0-9_.-]{2,}@[A-Za-z0-9_]{2,}$' then perform public.fail('invalid', null, '{"fields":["upi"]}'); end if;
    p_method := jsonb_build_object('type', 'upi', 'upi', p_method ->> 'upi');
  elsif t = 'bank' then
    if coalesce(p_method ->> 'account', '') !~ '^[0-9]{9,18}$' or coalesce(p_method ->> 'ifsc', '') !~ '^[A-Z]{4}0[A-Z0-9]{6}$' then
      perform public.fail('invalid', null, '{"fields":["account","ifsc"]}');
    end if;
    p_method := jsonb_build_object('type', 'bank', 'account', p_method ->> 'account', 'ifsc', p_method ->> 'ifsc');
  else
    perform public.fail('invalid', null, '{"fields":["payoutMethod"]}');
  end if;
  insert into public.artist_private (profile_id, legal_name, pan, payout_method, phone_verified, verified_at)
  values (uid, btrim(p_legal_name), p_pan, p_method, coalesce(auth.jwt() ->> 'phone', '') <> '', null)
  on conflict (profile_id) do update set legal_name = excluded.legal_name, pan = excluded.pan, payout_method = excluded.payout_method,
    phone_verified = excluded.phone_verified, verified_at = null;   -- any edit re-opens the Admin's check
  return '{}'::jsonb;
end $$;

create or replace function public.mark_verified(p_artist uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then perform public.fail('forbidden'); end if;
  update public.artist_private set verified_at = now() where profile_id = p_artist;
  if not found then perform public.fail('conflict', 'not_found'); end if;
  return '{}'::jsonb;
end $$;

-- Restriction hides an Artist's work by flipping artist_open. Listing status is never touched, so lifting it restores exactly what was live.
create or replace function public._set_standing(p_artist uuid, p_restricted boolean, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set restricted = p_restricted where id = p_artist;
  update public.artist_private set restriction_reasons = case when p_restricted then array_append(restriction_reasons, p_reason) else '{}' end where profile_id = p_artist;
  update public.artworks set artist_open = not p_restricted where artist_id = p_artist;
  update public.listings set artist_open = not p_restricted where artist_id = p_artist;
end $$;

create or replace function public.restrict_artist(p_artist uuid, p_restricted boolean, p_reason text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then perform public.fail('forbidden'); end if;
  if p_restricted and btrim(coalesce(p_reason, '')) = '' then perform public.fail('invalid', null, '{"fields":["reason"]}'); end if;
  perform public._set_standing(p_artist, p_restricted, left(coalesce(p_reason, ''), 300));
  return '{}'::jsonb;
end $$;

-- ---------- the 5-minute sweep: every time-based rule, each idempotent ----------
create or replace function public.sweep() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r record; n_exp integer := 0; n_rem integer; n_over integer; n_auto integer := 0; n_pay integer; n_res integer := 0;
begin
  for r in select id from public.orders where stage = 'hold' and hold_until <= now() order by hold_until limit 200 loop
    if public.expire_hold(r.id) then n_exp := n_exp + 1; end if;
  end loop;

  with u as (update public.orders set reminded = true where stage = 'paid' and not reminded and ship_by <= now() + interval '2 days'
             returning id, artist_id, ship_by)
  insert into public.notifications (user_id, type, data) select artist_id, 'ship_reminder', jsonb_build_object('orderId', id, 'shipBy', ship_by) from u;
  get diagnostics n_rem = row_count;

  update public.orders set overdue = true where stage = 'paid' and not overdue and ship_by <= now();   -- the Admin queue is overdue = true
  get diagnostics n_over = row_count;

  for r in select id from public.orders where stage = 'shipped' and auto_receive_at <= now() order by auto_receive_at limit 200 loop
    perform public._set_received(r.id); n_auto := n_auto + 1;
  end loop;

  update public.orders set payable = true where stage = 'received' and not payable and not open_report and damage_window_ends <= now();
  get diagnostics n_pay = row_count;

  for r in select profile_id from public.artist_private ap join public.profiles p on p.id = ap.profile_id
           where ap.owed_since <= now() - interval '60 days' and ap.amount_owed > 0 and not p.restricted limit 200 loop
    perform public._set_standing(r.profile_id, true, 'owed_60_days'); n_res := n_res + 1;
  end loop;
  return jsonb_build_object('expireHolds', n_exp, 'shipReminder', n_rem, 'overdue', n_over, 'autoReceive', n_auto, 'payable', n_pay, 'restrictOwed', n_res);
end $$;

-- ---------- triggers ----------
-- Who is told when an Order enters a stage. Nothing is sent when an Order is created in "hold".
create or replace function public._notify_order_stage() returns trigger language plpgsql security definer set search_path = '' as $$
declare d jsonb := jsonb_build_object('orderId', new.id, 'code', new.code, 'amount', new.total);
begin
  if new.stage = 'paid' then
    insert into public.notifications (user_id, type, data) values (new.buyer_id, 'order_paid', d), (new.artist_id, 'order_new', d);
  elsif new.stage = 'shipped' then insert into public.notifications (user_id, type, data) values (new.buyer_id, 'order_shipped', d);
  elsif new.stage = 'received' then insert into public.notifications (user_id, type, data) values (new.artist_id, 'order_received', d);
  elsif new.stage = 'refunded' then insert into public.notifications (user_id, type, data) values (new.buyer_id, 'order_refunded', d);
  end if;
  return new;
end $$;
create trigger orders_notify after update of stage on public.orders for each row when (old.stage is distinct from new.stage) execute function public._notify_order_stage();

-- Browse reads one Artwork row: keep its "from price" and availability in step with its Listings.
create or replace function public._sync_artwork() returns trigger language plpgsql security definer set search_path = '' as $$
declare a uuid := coalesce(new.artwork_id, old.artwork_id);
begin
  update public.artworks set
    from_price_paise = (select min(price) from public.listings where artwork_id = a and status = 'live' and artist_open),
    available = exists (select 1 from public.listings where artwork_id = a and status = 'live' and artist_open and stock - held > 0)
  where id = a;
  return null;
end $$;
create trigger listings_sync after insert or update or delete on public.listings for each row execute function public._sync_artwork();

-- New Artworks and Listings start open unless the Artist is restricted (the client cannot set artist_open).
create or replace function public._start_open() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.artist_open := not coalesce((select restricted from public.profiles where id = new.artist_id), false);
  return new;
end $$;
create trigger artworks_start_open before insert on public.artworks for each row execute function public._start_open();
create trigger listings_start_open before insert on public.listings for each row execute function public._start_open();

-- ---------- who may call what (Supabase grants execute to everyone by default) ----------
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname not in ('is_admin', 'is_artist', 'rls_auto_enable') loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;
grant execute on function public.mark_shipped(uuid, text, text), public.confirm_received(uuid),
  public.report_damage(uuid, uuid[], text, text[]), public.submit_review(uuid, integer, text), public.report(text, uuid, text),
  public.submit_verification(text, text, jsonb), public.decide_damage(uuid, text, text), public.decide_review(uuid, text),
  public.mark_verified(uuid), public.restrict_artist(uuid, boolean, text), public.build_payout_run(), public.record_payout(uuid, text)
  to authenticated;
