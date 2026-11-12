create function public.search_catalogue(p_query text, p_artists boolean, p_categories text[], p_offset integer)
returns setof jsonb language sql stable security invoker set search_path = '' as $$
  with needle as (select lower(btrim(left(p_query, 100))) as q),
  candidates as (
    select a.id, lower(a.title) as label,
      to_jsonb(a) || jsonb_build_object('artist', jsonb_build_object('display_name', p.display_name)) as item
    from public.artworks a join public.profiles p on p.id = a.artist_id
    where not p_artists and a.status = 'published' and a.artist_open and not p.restricted
      and (p_categories is null or a.category = any(p_categories))
    union all
    select p.id, lower(p.display_name),
      jsonb_build_object('id', p.id, 'display_name', p.display_name, 'photo_url', p.photo_url)
    from public.profiles p
    where p_artists and not p.restricted and 'artist' = any(p.roles)
  )
  select item from candidates cross join needle
  where q <> '' and strpos(label, q) > 0
  order by case when label = q then 0 when starts_with(label, q) then 1 else 2 end, label, id
  limit 25 offset greatest(0, p_offset);
$$;
revoke execute on function public.search_catalogue(text, boolean, text[], integer) from public;
grant execute on function public.search_catalogue(text, boolean, text[], integer) to anon, authenticated;
