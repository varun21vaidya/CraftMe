-- P04 Account: policy acceptance, profile photos, every notification producer, and self-serve account deletion (D11).
-- Additive: the deployed web app and Edge Function keep working after this is applied.

-- 1. Policy acceptance. Clients cannot write these columns (the update grant on profiles is column-limited); accept_terms does.
alter table public.profiles add column terms_accepted_at timestamptz, add column terms_version text;

create function public.accept_terms(p_version text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then perform public.fail('forbidden'); end if;
  if btrim(coalesce(p_version, '')) = '' or char_length(p_version) > 40 then perform public.fail('invalid', null, '{"fields":["version"]}'); end if;
  update public.profiles set terms_accepted_at = now(), terms_version = btrim(p_version) where id = auth.uid();
  return '{}'::jsonb;
end $$;

-- 2. Profile photos: public to read, a person writes only inside their own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png'])
on conflict (id) do nothing;
create policy craftme_upload_avatar on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy craftme_delete_avatar on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy craftme_read_avatar on storage.objects for select using (bucket_id = 'avatars');

-- 3. Notification producers. All are triggers, so the command functions stay as they are.
create index notifications_unread on public.notifications (user_id) where not read;

-- Who is told when an Order enters a stage. A full refund no longer sends order_refunded: refund_issued says it with the amount.
create or replace function public._notify_order_stage() returns trigger language plpgsql security definer set search_path = '' as $$
declare d jsonb := jsonb_build_object('orderId', new.id, 'code', new.code, 'amount', new.total);
begin
  if new.stage = 'paid' then
    insert into public.notifications (user_id, type, data) values (new.buyer_id, 'order_paid', d), (new.artist_id, 'order_new', d);
  elsif new.stage = 'shipped' then
    insert into public.notifications (user_id, type, data) values (new.buyer_id, 'order_shipped', d);
  elsif new.stage = 'received' then
    insert into public.notifications (user_id, type, data) values
      (new.artist_id, 'order_received', d),
      (new.buyer_id, 'review_prompt', d || jsonb_build_object('reviewBy', new.review_by, 'auto', coalesce(new.received_at >= new.auto_receive_at, false)));
  end if;
  return new;
end $$;

create function public._notify_refund() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id, type, data)
  select new.buyer_id, 'refund_issued', jsonb_build_object('orderId', new.order_id, 'code', o.code, 'amount', new.amount)
  from public.orders o where o.id = new.order_id;
  return new;
end $$;
create trigger refunds_notify_insert after insert on public.refunds for each row when (new.status = 'issued') execute function public._notify_refund();
create trigger refunds_notify_update after update of status on public.refunds for each row
  when (new.status = 'issued' and old.status is distinct from new.status) execute function public._notify_refund();

create function public._notify_damage() returns trigger language plpgsql security definer set search_path = '' as $$
declare d jsonb;
begin
  select jsonb_build_object('orderId', o.id, 'code', o.code) into d from public.orders o where o.id = new.order_id;
  if tg_op = 'INSERT' then
    insert into public.notifications (user_id, type, data) values (new.artist_id, 'damage_reported', d);
  else
    insert into public.notifications (user_id, type, data) values
      (new.buyer_id, case new.status when 'upheld' then 'damage_upheld' else 'damage_rejected' end, d),
      (new.artist_id, 'damage_decided', d);
  end if;
  return new;
end $$;
create trigger damage_notify_insert after insert on public.damage_reports for each row execute function public._notify_damage();
create trigger damage_notify_decided after update of status on public.damage_reports for each row
  when (old.status = 'open' and new.status in ('upheld', 'rejected')) execute function public._notify_damage();

create function public._notify_review() returns trigger language plpgsql security definer set search_path = '' as $$
declare d jsonb;
begin
  select jsonb_build_object('orderId', o.id, 'code', o.code) into d from public.orders o where o.id = new.order_id;
  insert into public.notifications (user_id, type, data) values (new.buyer_id, case new.status when 'approved' then 'review_approved' else 'review_rejected' end, d);
  if new.status = 'approved' then
    insert into public.notifications (user_id, type, data) values (new.artist_id, 'review_new', d);
  end if;
  return new;
end $$;
create trigger reviews_notify after update of status on public.reviews for each row
  when (old.status = 'pending' and new.status in ('approved', 'rejected')) execute function public._notify_review();

create function public._notify_payout() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id, type, data)
  values (new.artist_id, 'payout_sent', jsonb_build_object('payoutId', new.id, 'net', new.net, 'reference', new.reference));
  return new;
end $$;
create trigger payouts_notify after update of status on public.payouts for each row
  when (old.status is distinct from 'sent' and new.status = 'sent') execute function public._notify_payout();

create function public._notify_verified() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id, type, data) values (new.profile_id, 'artist_verified', '{}');
  return new;
end $$;
create trigger artist_private_notify after update of verified_at on public.artist_private for each row
  when (old.verified_at is null and new.verified_at is not null) execute function public._notify_verified();

create function public._notify_standing() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id, type, data) values (new.id, case when new.restricted then 'shop_restricted' else 'shop_reinstated' end, '{}');
  return new;
end $$;
create trigger profiles_notify_standing after update of restricted on public.profiles for each row
  when (old.restricted is distinct from new.restricted) execute function public._notify_standing();

-- 4. Account deletion. A request waits while the person still has money or Orders in flight, then anonymises in one transaction.
create table public.deletion_requests (
  user_id uuid primary key references public.profiles(id),
  scope text not null check (scope in ('everything', 'instagram')),
  status text not null default 'pending' check (status in ('pending', 'waiting', 'done', 'cancelled')),
  blockers text[] not null default '{}',
  requested_at timestamptz not null default now(),
  checked_at timestamptz,
  done_at timestamptz
);
alter table public.deletion_requests enable row level security;
create policy deletion_requests_read on public.deletion_requests for select to authenticated using (user_id = auth.uid() or public.is_admin());
revoke all on public.deletion_requests from anon, authenticated;
grant select on public.deletion_requests to authenticated;

-- What keeps an Artist's account open: Orders to ship, open Damage Reports, money not yet paid out, money they owe.
-- One function, so the Admin screens in P07 and P09 say the same thing.
create function public.artist_obligations(p_user uuid) returns text[] language sql stable security definer set search_path = '' as $$
  select array_remove(array[
    case when exists (select 1 from public.orders where artist_id = p_user and stage in ('paid', 'shipped')) then 'artist_open_orders' end,
    case when exists (select 1 from public.damage_reports where artist_id = p_user and status = 'open') then 'open_reports' end,
    case when exists (select 1 from public.orders where artist_id = p_user and payable and payout_id is null)
           or exists (select 1 from public.payouts where artist_id = p_user and status = 'draft') then 'unpaid_payouts' end,
    case when coalesce((select amount_owed from public.artist_private where profile_id = p_user), 0) > 0 then 'amount_owed' end
  ], null) $$;

create function public.deletion_blockers(p_user uuid) returns text[] language sql stable security definer set search_path = '' as $$
  select array_remove(array[
    case when exists (select 1 from public.orders where buyer_id = p_user and (
      stage in ('hold', 'paid', 'shipped') or (stage = 'received' and (open_report or now() <= damage_window_ends)))) then 'buyer_open_orders' end
  ], null) || public.artist_obligations(p_user) $$;

create function public.request_deletion(p_scope text, p_confirm text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); b text[]; s text; cur text;
begin
  if uid is null then perform public.fail('forbidden'); end if;
  if p_confirm is distinct from 'DELETE' then perform public.fail('invalid', null, '{"fields":["confirm"]}'); end if;
  if p_scope is distinct from 'everything' then perform public.fail('invalid', null, '{"fields":["scope"]}'); end if;
  select status into cur from public.deletion_requests where user_id = uid;
  if cur = 'done' then perform public.fail('conflict', 'already_done'); end if;
  b := public.deletion_blockers(uid);
  s := case when cardinality(b) > 0 then 'waiting' else 'pending' end;
  insert into public.deletion_requests (user_id, scope, status, blockers, requested_at, checked_at)
  values (uid, p_scope, s, b, now(), now())
  on conflict (user_id) do update set scope = excluded.scope, status = excluded.status, blockers = excluded.blockers,
    requested_at = excluded.requested_at, checked_at = excluded.checked_at, done_at = null;
  return jsonb_build_object('status', s, 'blockers', to_jsonb(b));
end $$;

create function public.cancel_deletion() returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then perform public.fail('forbidden'); end if;
  update public.deletion_requests set status = 'cancelled' where user_id = auth.uid() and status in ('pending', 'waiting');
  return '{}'::jsonb;
end $$;

-- The daily job (service role). Returns the ids it finished; the Edge Function then removes their files and auth users.
create function public.process_deletions() returns uuid[] language plpgsql security definer set search_path = '' as $$
declare r record; b text[]; done uuid[] := '{}'; keep boolean;
begin
  for r in select user_id from public.deletion_requests where scope = 'everything' and status in ('pending', 'waiting') order by requested_at loop
    b := public.deletion_blockers(r.user_id);
    if cardinality(b) > 0 then
      update public.deletion_requests set status = 'waiting', blockers = b, checked_at = now() where user_id = r.user_id;
      continue;
    end if;
    -- the verified lock on the Instagram handle must be lifted before the handle is emptied
    update public.profiles set instagram_verified = false, instagram_needs_reconnect = false where id = r.user_id;
    update public.profiles set display_name = 'Deleted user', photo_url = '', bio = '', instagram_handle = '', city = '', state = '',
      roles = '{}', slug = null, showcase = '[]' where id = r.user_id;
    delete from public.saved_addresses where user_id = r.user_id;
    delete from public.notifications where user_id = r.user_id;
    delete from public.saved_works where user_id = r.user_id;
    delete from public.collections where user_id = r.user_id;
    delete from public.saved_cart_items where buyer_id = r.user_id;
    delete from public.reels where artist_id = r.user_id;
    delete from public.instagram_states where artist_id = r.user_id;
    delete from public.instagram_accounts where artist_id = r.user_id;
    update public.reviews set buyer_name = 'Buyer' where buyer_id = r.user_id;
    delete from public.order_shipping where order_id in (select id from public.orders where buyer_id = r.user_id and stage not in ('hold', 'paid', 'shipped'));
    update public.artworks set status = 'removed' where artist_id = r.user_id;
    update public.listings set status = 'ended' where artist_id = r.user_id and status in ('draft', 'live'); -- a sold Listing keeps its history
    keep := exists (select 1 from public.payouts where artist_id = r.user_id);
    update public.artist_private set payout_method = null, legal_name = case when keep then legal_name end, pan = case when keep then pan end
    where profile_id = r.user_id;
    update public.deletion_requests set status = 'done', blockers = '{}', checked_at = now(), done_at = now() where user_id = r.user_id;
    done := done || r.user_id;
  end loop;
  return done;
end $$;

-- Files to remove once a person is gone: the avatar folder and Artwork files that never sold (a sold work's photos stay on its Orders).
create function public.deletion_files(p_user uuid) returns text[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(o.bucket_id || '/' || o.name), '{}') from storage.objects o
  where (storage.foldername(o.name))[1] = p_user::text and (
    o.bucket_id = 'avatars'
    or (o.bucket_id = 'artworks' and not exists (
      select 1 from public.artworks a join public.order_lines l on l.artwork_id = a.id
      where a.artist_id = p_user and (o.bucket_id || '/' || o.name) = any (a.photos)))) $$;

-- 5. Grants.
revoke execute on function public.accept_terms(text), public.request_deletion(text, text), public.cancel_deletion(),
  public.artist_obligations(uuid), public.deletion_blockers(uuid), public.process_deletions(), public.deletion_files(uuid) from public, anon, authenticated;
grant execute on function public.accept_terms(text), public.request_deletion(text, text), public.cancel_deletion() to authenticated, service_role;
grant execute on function public.artist_obligations(uuid), public.deletion_blockers(uuid), public.process_deletions(), public.deletion_files(uuid) to service_role;
