-- P02 Damage Report: the D08 limits in SQL and in storage, a kind and a reference code on each report,
-- and the list of photo files no report points to (for the cleanup job).

alter table public.damage_reports
  add column kind text not null default 'other' check (kind in ('torn', 'broken', 'water', 'wrong_item', 'other')),
  add column code text not null default upper(left(replace(gen_random_uuid()::text, '-', ''), 6)),
  add constraint damage_note_len check (char_length(note) <= 800),
  add constraint damage_photo_count check (cardinality(photos) <= 6);

-- Replaced: 2 to 6 photos that really exist as JPEG or PNG, a kind, 800 characters, one of each line at most.
drop function public.report_damage(uuid, uuid[], text, text[]);
create function public.report_damage(p_order uuid, p_line_ids uuid[], p_note text, p_photos text[], p_kind text default 'other') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare o public.orders%rowtype; uid uuid := auth.uid(); p text; rid uuid; rcode text;
begin
  if coalesce(cardinality(p_line_ids), 0) = 0 or (select count(distinct x) from unnest(p_line_ids) x) <> cardinality(p_line_ids)
     or exists (select 1 from unnest(p_line_ids) id where id is null or id not in (select listing_id from public.order_lines where order_id = p_order)) then
    perform public.fail('invalid', null, '{"fields":["lineIds"]}');
  end if;
  if char_length(btrim(coalesce(p_note, ''))) not between 1 and 800 then perform public.fail('invalid', null, '{"fields":["note"]}'); end if;
  if p_kind is null or p_kind not in ('torn', 'broken', 'water', 'wrong_item', 'other') then perform public.fail('invalid', null, '{"fields":["kind"]}'); end if;
  if coalesce(cardinality(p_photos), 0) not between 2 and 6 or (select count(distinct x) from unnest(p_photos) x) <> cardinality(p_photos) then
    perform public.fail('invalid', null, '{"fields":["photoPaths"]}');
  end if;
  foreach p in array p_photos loop   -- each photo sits in the caller's own folder and is a stored JPEG or PNG
    if p is null or p not like 'damage/' || uid::text || '/%' or not exists (
      select 1 from storage.objects so where so.bucket_id = 'damage' and so.name = substr(p, 8) and so.metadata ->> 'mimetype' in ('image/jpeg', 'image/png')) then
      perform public.fail('invalid', null, '{"fields":["photoPaths"]}');
    end if;
  end loop;
  select * into o from public.orders where id = p_order for update;
  if not found then perform public.fail('conflict', 'not_found'); end if;
  if o.buyer_id is distinct from uid then perform public.fail('forbidden'); end if;
  if o.stage <> 'received' then perform public.fail('conflict', 'wrong_stage'); end if;
  if o.damage_reported or o.open_report then perform public.fail('conflict', 'already_exists'); end if;
  if now() > o.damage_window_ends then perform public.fail('conflict', 'window_closed'); end if;
  insert into public.damage_reports (order_id, buyer_id, artist_id, line_ids, photos, note, kind)
    values (p_order, uid, o.artist_id, p_line_ids, p_photos, btrim(p_note), p_kind) returning id, code into rid, rcode;
  update public.orders set open_report = true, damage_reported = true where id = p_order;
  return jsonb_build_object('reportId', rid, 'code', rcode);
end $$;

-- Storage: photos are JPEG or PNG only (5 MB stays); a buyer may delete their own photo until a report uses it.
update storage.buckets set allowed_mime_types = array['image/jpeg', 'image/png'] where id = 'damage';
create policy craftme_delete_own_damage on storage.objects for delete to authenticated
  using (bucket_id = 'damage' and (storage.foldername(name))[1] = auth.uid()::text
    and not exists (select 1 from public.damage_reports d where ('damage/' || name) = any (d.photos)));

-- Photo files older than p_older that no report refers to; the cleanup job removes them through the storage API.
create function public.damage_orphans(p_older interval default '24 hours') returns setof text
language sql stable security definer set search_path = '' as $$
  select o.name from storage.objects o
  where o.bucket_id = 'damage' and o.created_at < now() - p_older
    and not exists (select 1 from public.damage_reports d where ('damage/' || o.name) = any (d.photos));
$$;

revoke execute on function public.report_damage(uuid, uuid[], text, text[], text), public.damage_orphans(interval) from public, anon, authenticated;
grant execute on function public.report_damage(uuid, uuid[], text, text[], text) to authenticated, service_role;
grant execute on function public.damage_orphans(interval) to service_role;
