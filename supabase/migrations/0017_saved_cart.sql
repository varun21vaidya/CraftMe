create table public.saved_cart_items (
  buyer_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  qty integer not null check (qty > 0),
  primary key (buyer_id, listing_id)
);
create table public.saved_cart_operations (
  buyer_id uuid not null references auth.users(id) on delete cascade,
  operation_id uuid not null,
  result jsonb not null,
  primary key (buyer_id, operation_id)
);
alter table public.saved_cart_items enable row level security;
alter table public.saved_cart_operations enable row level security;
revoke all on public.saved_cart_items, public.saved_cart_operations from anon, authenticated;
grant select on public.saved_cart_items to authenticated;
create policy saved_cart_owner on public.saved_cart_items for select to authenticated using (buyer_id = auth.uid());

create function public.switch_saved_cart(p_buyer uuid, p_operation uuid, p_active jsonb, p_restore uuid[], p_new uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  buyer uuid := auth.uid();
  target_artist uuid;
  result jsonb;
  items jsonb := '[]';
  line record;
  current_qty integer;
  moved integer;
  excess boolean := false;
  unavailable uuid[];
begin
  if buyer is null or buyer is distinct from p_buyer then
    raise exception using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(buyer::text, 0));
  select o.result into result from public.saved_cart_operations o
  where o.buyer_id = buyer and o.operation_id = p_operation;
  if found then return result; end if;

  if p_new is not null then
    p_restore := array[p_new];
  end if;
  select array_agg(id) into unavailable
  from unnest(p_restore) as requested(id)
  where not exists (
    select 1 from public.listings l join public.artworks a on a.id = l.artwork_id
    where l.id = requested.id and l.status = 'live' and l.artist_open
      and a.status = 'published' and a.artist_open and l.artist_id <> buyer
      and l.stock - l.held >= case when p_new is not null then 1 else least(10,
        coalesce((select s.qty from public.saved_cart_items s
         where s.buyer_id = buyer and s.listing_id = l.id), 0)
        + coalesce((select max(x.qty) from jsonb_to_recordset(p_active) as x("listingId" uuid, qty integer)
          where x."listingId" = l.id and x.qty between 1 and 10), 0))
      end
      and (p_new is not null or exists (
        select 1 from public.saved_cart_items s where s.buyer_id = buyer and s.listing_id = l.id))
  );
  if unavailable is not null then
    return jsonb_build_object('unavailable', unavailable);
  end if;

  select l.artist_id into target_artist from public.listings l where l.id = p_restore[1];
  if target_artist is null or exists (
    select 1 from public.listings l where l.id = any(p_restore) and l.artist_id <> target_artist
  ) then raise exception 'Invalid cart selection'; end if;

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

  if p_new is not null then
    items := jsonb_build_array(jsonb_build_object('listingId', p_new, 'qty', 1));
  else
    for line in
      select s.listing_id, s.qty
      from public.saved_cart_items s where s.buyer_id = buyer and s.listing_id = any(p_restore)
    loop
      select coalesce(max((entry->>'qty')::integer), 0) into current_qty
      from jsonb_array_elements(items) entry where entry->>'listingId' = line.listing_id::text;
      moved := least(line.qty, 10 - current_qty);
      if moved = line.qty then
        delete from public.saved_cart_items s where s.buyer_id = buyer and s.listing_id = line.listing_id;
      else
        update public.saved_cart_items s set qty = s.qty - moved
        where s.buyer_id = buyer and s.listing_id = line.listing_id;
        excess := true;
      end if;
      select coalesce(jsonb_agg(entry), '[]') into items
      from jsonb_array_elements(items) entry where entry->>'listingId' <> line.listing_id::text;
      items := items || jsonb_build_array(jsonb_build_object('listingId', line.listing_id, 'qty', current_qty + moved));
    end loop;
  end if;

  result := jsonb_build_object('artistId', target_artist, 'items', items, 'excess', excess);
  insert into public.saved_cart_operations values (buyer, p_operation, result);
  return result;
end $$;
revoke execute on function public.switch_saved_cart(uuid, uuid, jsonb, uuid[], uuid) from public;
grant execute on function public.switch_saved_cart(uuid, uuid, jsonb, uuid[], uuid) to authenticated;
