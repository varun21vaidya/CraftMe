-- P01 checkout: fuller address, gift note, payment method, a saved address, order counts and the group cart switch (D07).
-- Additive: the deployed web app and Edge Function keep working after this is applied.

-- 1-2. more address lines, the gift note and the payment method (display data, written by the Edge Function)
alter table public.order_shipping
  add column address2 text not null default '' check (char_length(address2) <= 300),
  add column landmark text not null default '' check (char_length(landmark) <= 120);
alter table public.orders
  add column gift_note text not null default '' check (char_length(gift_note) <= 120),
  add column payment_method text;

-- 3. one saved address per user
create table public.saved_addresses (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  phone text not null check (phone ~ '^[6-9][0-9]{9}$'),
  address text not null check (char_length(address) between 1 and 300),
  address2 text not null default '' check (char_length(address2) <= 300),
  landmark text not null default '' check (char_length(landmark) <= 120),
  city text not null check (char_length(city) between 1 and 80),
  state text not null check (char_length(state) between 1 and 80),
  pin text not null check (pin ~ '^[0-9]{6}$'),
  updated_at timestamptz not null default now()
);
alter table public.saved_addresses enable row level security;
create policy saved_addresses_read on public.saved_addresses for select to authenticated using (user_id = auth.uid());
create policy saved_addresses_insert on public.saved_addresses for insert to authenticated with check (user_id = auth.uid());
create policy saved_addresses_update on public.saved_addresses for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy saved_addresses_delete on public.saved_addresses for delete to authenticated using (user_id = auth.uid());
revoke all on public.saved_addresses from anon, authenticated;
grant select, insert, update, delete on public.saved_addresses to authenticated;
grant all on public.saved_addresses to service_role;

-- 4. place_order: same signature and body, plus address2, landmark, note and save read from p_address,
--    and order_lines.title now snapshots the artwork's title instead of the listing's version name
create or replace function public.place_order(p_buyer uuid, p_artist uuid, p_lines jsonb, p_address jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_order uuid; v_code text; v_total bigint := 0; l jsonb; x public.listings%rowtype; qty integer; changed jsonb := '[]';
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

  insert into public.orders (code, buyer_id, artist_id, total, stage, hold_until, gift_note)
  values (upper(left(replace(gen_random_uuid()::text, '-', ''), 6)), p_buyer, p_artist, 0, 'hold', v_hold,
          left(btrim(coalesce(p_address ->> 'note', '')), 120))
  returning id, code into v_order, v_code;

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
    -- the line keeps the artwork's name as it was when bought (the listing title is only the version, e.g. "Print")
    insert into public.order_lines (order_id, listing_id, artwork_id, title, kind, unit_paise, quantity)
    values (v_order, x.id, x.artwork_id, coalesce(nullif((select a.title from public.artworks a where a.id = x.artwork_id), ''), x.title), x.kind, x.price, qty);
    v_total := v_total + x.price * qty;
  end loop;
  if jsonb_array_length(changed) > 0 then perform public.fail('conflict', 'price_changed', jsonb_build_object('changedLines', changed)); end if;

  update public.orders set total = v_total where id = v_order;
  insert into public.order_shipping (order_id, name, phone, address, address2, landmark, city, state, pin)
  values (v_order, p_address ->> 'name', p_address ->> 'phone', p_address ->> 'address',
          coalesce(p_address ->> 'address2', ''), coalesce(p_address ->> 'landmark', ''),
          p_address ->> 'city', p_address ->> 'state', p_address ->> 'pin');
  if coalesce((p_address ->> 'save')::boolean, false) then
    insert into public.saved_addresses as s (user_id, name, phone, address, address2, landmark, city, state, pin)
    values (p_buyer, p_address ->> 'name', p_address ->> 'phone', p_address ->> 'address',
            coalesce(p_address ->> 'address2', ''), coalesce(p_address ->> 'landmark', ''),
            p_address ->> 'city', p_address ->> 'state', p_address ->> 'pin')
    on conflict (user_id) do update set name = excluded.name, phone = excluded.phone, address = excluded.address,
      address2 = excluded.address2, landmark = excluded.landmark, city = excluded.city, state = excluded.state,
      pin = excluded.pin, updated_at = now();
  end if;
  return jsonb_build_object('orderId', v_order, 'code', v_code, 'amount', v_total, 'holdUntil', v_hold, 'serverNow', now());
end $$;

-- 7. the buyer's order counts per tab (never counts the orders they sold as an Artist)
create function public.my_order_counts() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'paid', count(*) filter (where stage = 'paid'),
    'shipped', count(*) filter (where stage = 'shipped'),
    'received', count(*) filter (where stage = 'received'),
    'refunded', count(*) filter (where stage = 'refunded'),
    'all', count(*) filter (where stage <> 'hold_expired' and stage <> 'hold'))
  from public.orders where buyer_id = auth.uid()
$$;

-- 8. "Add all by this Artist" (D07): one switch for a group of listings, under the same lock and replay as switch_saved_cart
create function public.switch_saved_cart_many(p_buyer uuid, p_operation uuid, p_active jsonb, p_add uuid[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  buyer uuid := auth.uid();
  target_artist uuid;
  result jsonb;
  items jsonb := '[]';
  skipped jsonb := '[]';
  eligible uuid[] := '{}';
  line record;
  reason text;
begin
  if buyer is null or buyer is distinct from p_buyer then
    raise exception using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(buyer::text, 0));
  select o.result into result from public.saved_cart_operations o where o.buyer_id = buyer and o.operation_id = p_operation;
  if found then return result; end if;

  if coalesce(array_length(p_add, 1), 0) = 0
     or (select count(distinct l.artist_id) from public.listings l where l.id = any(p_add)) > 1 then
    raise exception 'Invalid cart selection';
  end if;
  select l.artist_id into target_artist from public.listings l where l.id = any(p_add) limit 1;

  for line in
    select requested.id, l.artist_id, l.status, l.stock, l.held, l.artist_open, a.status as art_status, a.artist_open as art_open
    from unnest(p_add) with ordinality as requested(id, n)
    left join public.listings l on l.id = requested.id
    left join public.artworks a on a.id = l.artwork_id
    order by requested.n
  loop
    reason := case
      when line.artist_id is null then 'gone'
      when line.artist_id = buyer then 'own'
      when line.status = 'sold' or line.stock = 0 then 'sold'
      when line.status <> 'live' or not line.artist_open or line.art_status <> 'published' or not line.art_open then 'gone'
      when line.stock - line.held < 1 then 'held'
    end;
    if reason is null then eligible := eligible || line.id;
    else skipped := skipped || jsonb_build_object('listingId', line.id, 'reason', reason);
    end if;
  end loop;

  if cardinality(eligible) = 0 then   -- nothing can be added: the active Cart stays where it is
    result := jsonb_build_object('unchanged', true, 'skipped', skipped);
    insert into public.saved_cart_operations values (buyer, p_operation, result);
    return result;
  end if;

  for line in
    select l.id, l.artist_id, max(x.qty) as qty
    from jsonb_to_recordset(p_active) as x("listingId" uuid, qty integer)
    join public.listings l on l.id = x."listingId"
    where x.qty between 1 and 10 and l.artist_id <> buyer
    group by l.id, l.artist_id
  loop
    if line.artist_id = target_artist then
      items := items || jsonb_build_array(jsonb_build_object('listingId', line.id, 'qty', line.qty));
    else
      insert into public.saved_cart_items as saved (buyer_id, listing_id, qty)
      values (buyer, line.id, line.qty)
      on conflict (buyer_id, listing_id) do update set qty = saved.qty + excluded.qty;
    end if;
  end loop;

  for line in select id from unnest(eligible) as e(id) loop
    if not exists (select 1 from jsonb_array_elements(items) entry where entry->>'listingId' = line.id::text) then
      items := items || jsonb_build_array(jsonb_build_object('listingId', line.id, 'qty', 1));
    end if;
  end loop;

  result := jsonb_build_object('artistId', target_artist, 'items', items, 'skipped', skipped);
  insert into public.saved_cart_operations values (buyer, p_operation, result);
  return result;
end $$;

-- 9. a new function is executable by everyone until revoked
revoke execute on function public.my_order_counts() from public, anon, authenticated;
revoke execute on function public.switch_saved_cart_many(uuid, uuid, jsonb, uuid[]) from public, anon, authenticated;
grant execute on function public.my_order_counts(), public.switch_saved_cart_many(uuid, uuid, jsonb, uuid[]) to authenticated, service_role;
