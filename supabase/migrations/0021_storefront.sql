-- P03 Storefront: Artist profile fields and short names, Artwork wall-label fields, Reports with details,
-- Browse with filters, public Artist stats and the review histogram, a view counter, and a safer public read of reviews.

-- 1. Artist profile: where they are, whether CraftMe has checked them, and a short name for sharing.
--    The id stays the permanent address; the slug only redirects to it.
alter table public.profiles
  add column city text not null default '' check (char_length(city) <= 80),
  add column state text not null default '' check (char_length(state) <= 80),
  add column verified boolean not null default false,
  add column slug text unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 30);
grant update (city, state) on public.profiles to authenticated;

-- The display name lower-cased, runs of other characters become one hyphen, at most 30 characters, "artist" if too short,
-- then -2, -3, ... until nobody has it.
create function public._make_slug(p_name text) returns text language plpgsql set search_path = '' as $$
declare base text; cand text; n integer := 1; suffix text;
begin
  base := btrim(regexp_replace(lower(coalesce(p_name, '')), '[^a-z0-9]+', '-', 'g'), '-');
  base := btrim(left(base, 30), '-');
  if char_length(base) < 3 then base := 'artist'; end if;
  cand := base;
  while exists (select 1 from public.profiles where slug = cand) loop
    n := n + 1;
    suffix := '-' || n;
    cand := btrim(left(base, 30 - char_length(suffix)), '-') || suffix;
  end loop;
  return cand;
end $$;

create function public._slug_on_artist() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.slug is null and 'artist' = any (new.roles) then new.slug := public._make_slug(new.display_name); end if;
  return new;
end $$;
create trigger profiles_slug before update of roles on public.profiles for each row execute function public._slug_on_artist();

do $$
declare r record;
begin
  for r in select id, display_name from public.profiles where 'artist' = any (roles) and slug is null order by created_at, id loop
    update public.profiles set slug = public._make_slug(r.display_name) where id = r.id;
  end loop;
end $$;

create function public.set_artist_slug(p_slug text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare s text := lower(btrim(coalesce(p_slug, '')));
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and 'artist' = any (roles)) then perform public.fail('forbidden'); end if;
  if s !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(s) not between 3 and 30
     or s ~ '^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$' then
    perform public.fail('invalid', null, '{"fields":["slug"]}');
  end if;
  begin
    update public.profiles set slug = s where id = auth.uid();
  exception when unique_violation then
    perform public.fail('conflict', 'slug_taken');
  end;
  return jsonb_build_object('slug', s);
end $$;

-- 2. Wall label fields (the editor arrives in P06).
alter table public.artworks
  add column year smallint check (year between 1900 and 2100),
  add column medium text not null default '' check (char_length(medium) <= 100),
  add column signed text check (signed in ('back', 'front', 'unsigned'));
grant insert (year, medium, signed), update (year, medium, signed) on public.artworks to authenticated;

-- 3. "Verified" follows the Admin's check.
create or replace function public.mark_verified(p_artist uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then perform public.fail('forbidden'); end if;
  update public.artist_private set verified_at = now() where profile_id = p_artist;
  if not found then perform public.fail('conflict', 'not_found'); end if;
  update public.profiles set verified = true where id = p_artist;
  return '{}'::jsonb;
end $$;

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
  update public.profiles set verified = false where id = uid;
  return '{}'::jsonb;
end $$;
update public.profiles p set verified = true from public.artist_private a where a.profile_id = p.id and a.verified_at is not null;

-- 4. Reports: a reason code from a fixed list, optional details, one open report per person and target.
alter table public.reports add column details text not null default '' check (char_length(details) <= 500);
update public.reports r set status = 'resolved'   -- older duplicates would block the index
  where status = 'open' and exists (select 1 from public.reports o where o.status = 'open' and o.reporter_id = r.reporter_id
    and o.target_type = r.target_type and o.target_id = r.target_id and (o.created_at, o.id) < (r.created_at, r.id));
create unique index reports_one_open on public.reports (reporter_id, target_type, target_id) where status = 'open';

drop function public.report(text, uuid, text);
create function public.report(p_target_type text, p_target uuid, p_reason text, p_details text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); owner uuid; rid uuid;
begin
  if uid is null then perform public.fail('forbidden'); end if;
  if p_target_type = 'artwork' then
    if p_reason is null or p_reason not in ('copied', 'mismatch', 'offensive', 'other') then perform public.fail('invalid', null, '{"fields":["reason"]}'); end if;
  elsif p_target_type = 'artist' then
    if p_reason is null or p_reason not in ('impersonation', 'mismatch', 'offensive', 'other') then perform public.fail('invalid', null, '{"fields":["reason"]}'); end if;
  else
    perform public.fail('invalid', null, '{"fields":["targetType"]}');
  end if;
  if char_length(coalesce(p_details, '')) > 500 then perform public.fail('invalid', null, '{"fields":["details"]}'); end if;
  if p_target_type = 'artwork' then
    select artist_id into owner from public.artworks where id = p_target and status = 'published' and artist_open;
  else
    select id into owner from public.profiles where id = p_target and 'artist' = any (roles) and not restricted;
  end if;
  if owner is null then perform public.fail('conflict', 'not_found'); end if;
  if owner = uid then perform public.fail('conflict', 'own_target'); end if;
  begin
    insert into public.reports (target_type, target_id, reporter_id, reason, details)
    values (p_target_type, p_target, uid, p_reason, btrim(coalesce(p_details, ''))) returning id into rid;
  exception when unique_violation then
    perform public.fail('conflict', 'already_exists');
  end;
  return jsonb_build_object('reportId', rid);
end $$;

-- 5. Browse. A work is public when it is published, its Artist is open and not restricted, and it has a live or sold Listing
--    (a work whose only Listing ended is hidden). `onlySold` is for the Artist page's Sold chip.
create function public.browse_catalogue(p jsonb) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare
  q text := lower(btrim(left(coalesce(p ->> 'q', ''), 100)));
  cats text[] := case when jsonb_typeof(p -> 'categories') = 'array' then array(select jsonb_array_elements_text(p -> 'categories')) end;
  kds text[] := case when jsonb_typeof(p -> 'kinds') = 'array' then array(select jsonb_array_elements_text(p -> 'kinds')) end;
  lo bigint := nullif(p ->> 'minPaise', '')::bigint;
  hi bigint := nullif(p ->> 'maxPaise', '')::bigint;
  who uuid := nullif(p ->> 'artist', '')::uuid;
  hide boolean := coalesce((p ->> 'hideSold')::boolean, false);
  only_sold boolean := coalesce((p ->> 'onlySold')::boolean, false);
  srt text := coalesce(p ->> 'sort', 'new');
  pg integer := greatest(0, coalesce(nullif(p ->> 'page', '')::integer, 0));
  tmp bigint;
  res jsonb;
begin
  if lo is not null and hi is not null and lo > hi then tmp := lo; lo := hi; hi := tmp; end if;
  with f as (
    select a.id, a.created_at, a.from_price_paise, pr.rating_avg, pr.rating_count,
      to_jsonb(a) || jsonb_build_object(
        'artist', jsonb_build_object('display_name', pr.display_name),
        'kinds', coalesce((select jsonb_agg(distinct l.kind) from public.listings l where l.artwork_id = a.id and l.status = 'live'), '[]')) as item
    from public.artworks a join public.profiles pr on pr.id = a.artist_id
    where a.status = 'published' and a.artist_open and not pr.restricted
      and exists (select 1 from public.listings l where l.artwork_id = a.id and l.status in ('live', 'sold'))
      and (q = '' or strpos(lower(a.title), q) > 0 or strpos(lower(pr.display_name), q) > 0 or strpos(lower(a.medium), q) > 0
           or exists (select 1 from public.listings l where l.artwork_id = a.id and l.status = 'live' and strpos(lower(l.medium), q) > 0))
      and (cats is null or a.category = any (cats))
      and (kds is null or exists (select 1 from public.listings l where l.artwork_id = a.id and l.status = 'live' and l.kind = any (kds)))
      and (lo is null or a.from_price_paise >= lo) and (hi is null or a.from_price_paise <= hi)
      and (who is null or a.artist_id = who)
      and (not hide or a.available) and (not only_sold or not a.available)
  ), ranked as (
    select item, row_number() over (order by
      case when srt = 'price_asc' then from_price_paise end asc nulls last,
      case when srt = 'price_desc' then from_price_paise end desc nulls last,
      case when srt = 'rating' then rating_avg end desc, case when srt = 'rating' then rating_count end desc,
      created_at desc, id) as rn
    from f)
  select jsonb_build_object('total', (select count(*) from f),
    'items', coalesce((select jsonb_agg(item order by rn) from ranked where rn between pg * 24 + 1 and pg * 24 + 24), '[]'))
  into res;
  return res;
end $$;

-- 6. Public numbers for an Artist's page; null for anyone who is not an open Artist.
create function public.artist_public_stats(p_artist uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'artworks', (select count(*) from public.artworks a where a.artist_id = p.id and a.status = 'published' and a.artist_open
                  and exists (select 1 from public.listings l where l.artwork_id = a.id and l.status in ('live', 'sold'))),
    'ordersShipped', (select count(*) from public.orders o where o.artist_id = p.id and o.shipped_at is not null),
    'avgShipHours', (select round(avg(extract(epoch from (o.shipped_at - o.paid_at)) / 3600)::numeric, 1)
                     from public.orders o where o.artist_id = p.id and o.shipped_at is not null and o.paid_at is not null))
  from public.profiles p where p.id = p_artist and 'artist' = any (p.roles) and not p.restricted
$$;

-- 7. Approved reviews per star.
create function public.artist_review_summary(p_artist uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('1', count(*) filter (where rating = 1), '2', count(*) filter (where rating = 2), '3', count(*) filter (where rating = 3),
    '4', count(*) filter (where rating = 4), '5', count(*) filter (where rating = 5))
  from public.reviews where artist_id = p_artist and status = 'approved'
$$;

-- 8. A signed-out visitor reads reviews without buyer_id.
revoke select on public.reviews from anon;
grant select (order_id, artist_id, rating, comment, buyer_name, status, created_at) on public.reviews to anon;

-- 9. Counting a visit to an Artwork page (the client calls it once per browser session per work).
create function public.bump_view(p_artwork uuid) returns void
language sql security definer set search_path = '' as $$
  update public.artworks set views = views + 1 where id = p_artwork and status = 'published' and artist_open
$$;

revoke execute on function public._make_slug(text), public._slug_on_artist(), public.set_artist_slug(text), public.report(text, uuid, text, text),
  public.browse_catalogue(jsonb), public.artist_public_stats(uuid), public.artist_review_summary(uuid), public.bump_view(uuid)
  from public, anon, authenticated;
grant execute on function public.browse_catalogue(jsonb), public.artist_public_stats(uuid), public.artist_review_summary(uuid), public.bump_view(uuid) to anon, authenticated;
grant execute on function public.report(text, uuid, text, text), public.set_artist_slug(text) to authenticated;
grant execute on function public._make_slug(text), public._slug_on_artist(), public.set_artist_slug(text), public.report(text, uuid, text, text),
  public.browse_catalogue(jsonb), public.artist_public_stats(uuid), public.artist_review_summary(uuid), public.bump_view(uuid) to service_role;
