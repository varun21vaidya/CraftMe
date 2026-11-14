-- P06 Artist catalogue: the commands behind My Artworks and the Artwork editor.
-- Needs 0001 to 0023 (0021 gave artworks year, medium, signed and bump_view). The deployed app keeps working after this is applied.

-- 1. "Updated" on the list.
alter table public.artworks add column updated_at timestamptz not null default now();
create function public._touch_artwork() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
create trigger artworks_touch before update on public.artworks for each row execute function public._touch_artwork();

-- 2. One open Original per Artwork (an ended one makes room for a new one).
create unique index listings_one_original on public.listings (artwork_id) where kind = 'original' and status <> 'ended';

-- 3. A Listing becomes live only with something to sell. Held units changing under a live Listing is normal, so only the move to live is checked.
create function public._listing_live_guard() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'live' and (tg_op = 'INSERT' or old.status is distinct from 'live') and new.stock - new.held <= 0 then
    perform public.fail('invalid', 'out_of_stock', '{"fields":["stock"]}');
  end if;
  return new;
end $$;
create trigger listings_live_guard before insert or update on public.listings for each row execute function public._listing_live_guard();

-- 4. Commands. Each locks and checks its own Artwork: another Artist's id answers forbidden, an unknown or removed one conflict not_found.
create function public._own_artwork(p_artwork uuid, p_restricted_ok boolean default false) returns public.artworks
language plpgsql security definer set search_path = '' as $$
declare a public.artworks%rowtype;
begin
  if auth.uid() is null or not public.is_artist() then perform public.fail('forbidden'); end if;
  select * into a from public.artworks where id = p_artwork for update;
  if not found or a.status = 'removed' then
    if found and a.artist_id <> auth.uid() then perform public.fail('forbidden'); end if;
    perform public.fail('conflict', 'not_found');
  end if;
  if a.artist_id <> auth.uid() then perform public.fail('forbidden'); end if;
  if not p_restricted_ok and exists (select 1 from public.profiles where id = auth.uid() and restricted) then perform public.fail('conflict', 'artist_restricted'); end if;
  return a;
end $$;

create function public.publish_artwork(p_artwork uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.artworks%rowtype; bad text[] := '{}';
begin
  a := public._own_artwork(p_artwork);
  if btrim(a.title) = '' then bad := array_append(bad, 'title'); end if;
  if cardinality(a.photos) = 0 then bad := array_append(bad, 'photos'); end if;
  if not exists (select 1 from public.listings where artwork_id = a.id and status in ('draft', 'live')) then bad := array_append(bad, 'listings'); end if;
  if cardinality(bad) > 0 then perform public.fail('invalid', null, jsonb_build_object('fields', to_jsonb(bad))); end if;
  update public.listings set status = 'live' where artwork_id = a.id and status = 'draft';
  update public.artworks set status = 'published' where id = a.id;
  return '{}'::jsonb;
end $$;

-- Ends every open Listing and hides the Artwork. Paid Orders are untouched; sold Listings keep their status.
create function public.end_artwork(p_artwork uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.artworks%rowtype;
begin
  a := public._own_artwork(p_artwork, true);
  update public.listings set status = 'ended' where artwork_id = a.id and status in ('live', 'draft');
  update public.artworks set status = 'draft' where id = a.id;
  return '{}'::jsonb;
end $$;

create function public.reopen_artwork(p_artwork uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.artworks%rowtype; n integer;
begin
  a := public._own_artwork(p_artwork);
  update public.listings set status = 'live' where artwork_id = a.id and status = 'ended' and stock - held > 0;
  get diagnostics n = row_count;
  if n = 0 then
    if exists (select 1 from public.listings where artwork_id = a.id and status = 'live') then return '{}'::jsonb; end if; -- already open
    perform public.fail('conflict', 'out_of_stock');
  end if;
  update public.artworks set status = 'published' where id = a.id;
  return '{}'::jsonb;
end $$;

-- Only a work that never sold and is in nobody's checkout. Returns the files so the caller can remove them.
create function public.delete_artwork(p_artwork uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.artworks%rowtype; files jsonb;
begin
  begin
    a := public._own_artwork(p_artwork, true);
  exception when others then
    if sqlerrm like '%not_found%' then return jsonb_build_object('photos', '[]'::jsonb, 'video', null); end if; -- already gone: done
    raise;
  end;
  if a.has_sales or exists (select 1 from public.order_lines where artwork_id = a.id) then perform public.fail('conflict', 'has_sales'); end if;
  files := jsonb_build_object('photos', to_jsonb(a.photos), 'video', to_jsonb(a.video));
  update public.listings set status = 'ended' where artwork_id = a.id and status <> 'ended';
  update public.artworks set status = 'removed', photos = '{}', video = null, reel_id = null where id = a.id;
  return files;
end $$;

create function public.set_listing_stock(p_listing uuid, p_stock integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare l public.listings%rowtype;
begin
  if auth.uid() is null or not public.is_artist() then perform public.fail('forbidden'); end if;
  select * into l from public.listings where id = p_listing for update;
  if not found then perform public.fail('conflict', 'not_found'); end if;
  if l.artist_id <> auth.uid() then perform public.fail('forbidden'); end if;
  if exists (select 1 from public.profiles where id = auth.uid() and restricted) then perform public.fail('conflict', 'artist_restricted'); end if;
  if l.kind = 'original' then perform public.fail('invalid', 'original_stock', '{"fields":["stock"]}'); end if;
  if p_stock is null or p_stock < l.held or p_stock > 1000 then perform public.fail('invalid', 'stock_range', jsonb_build_object('fields', '["stock"]'::jsonb, 'held', l.held)); end if;
  update public.listings set stock = p_stock, status = case when status = 'sold' and p_stock - held > 0 then 'live' else status end where id = l.id;
  return '{}'::jsonb;
end $$;

-- What the Artist would receive for a price: the commission at today's rate and an assumed payment cost of 2.36% (PD19).
create function public.earnings_estimate(p_price bigint) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare bps integer; commission bigint; gateway bigint;
begin
  if auth.uid() is null or not public.is_artist() then perform public.fail('forbidden'); end if;
  if p_price is null or p_price < 100 then perform public.fail('invalid', null, '{"fields":["price"]}'); end if;
  select commission_bps into bps from public.settings limit 1;
  commission := round(p_price * coalesce(bps, 0) / 10000.0);
  gateway := round(p_price * 236 / 10000.0);
  return jsonb_build_object('commission', commission, 'gateway', gateway, 'net', p_price - commission - gateway);
end $$;

-- 5. Grants.
revoke execute on function public._own_artwork(uuid, boolean), public._touch_artwork(), public._listing_live_guard(), public.publish_artwork(uuid),
  public.end_artwork(uuid), public.reopen_artwork(uuid), public.delete_artwork(uuid), public.set_listing_stock(uuid, integer), public.earnings_estimate(bigint)
  from public, anon, authenticated;
grant execute on function public.publish_artwork(uuid), public.end_artwork(uuid), public.reopen_artwork(uuid), public.delete_artwork(uuid),
  public.set_listing_stock(uuid, integer), public.earnings_estimate(bigint) to authenticated, service_role;
