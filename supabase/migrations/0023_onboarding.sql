-- P05 Become an Artist: the details form, one row per fee order, and the fee amount for the browser.
-- Needs 0001 to 0022. The deployed app keeps working after this is applied: the old 3-argument call still resolves.

-- 1. What the onboarding form collects.
alter table public.artist_private
  add column holder_name text, add column phone text, add column specialties text[] not null default '{}',
  add column agreed_own_work_at timestamptz, add column agreed_terms_at timestamptz, add column submitted_at timestamptz;

-- 2. Every fee order. artist_private.onboarding_order_id holds only the latest, so a payment on an earlier order used to be ignored.
create table public.fee_orders (
  razorpay_order_id text primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  amount bigint not null check (amount > 0),
  created_at timestamptz not null default now(),
  payment_id text unique,
  paid_at timestamptz,
  refunded_at timestamptz
);
create index fee_orders_profile on public.fee_orders (profile_id, created_at desc);
alter table public.fee_orders enable row level security;
revoke all on public.fee_orders from anon, authenticated;
grant all on public.fee_orders to service_role;

-- 3. submit_verification with the onboarding fields. p_profile is given by the onboarding form only.
drop function public.submit_verification(text, text, jsonb);
create function public.submit_verification(p_legal_name text, p_pan text, p_method jsonb, p_profile jsonb default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); t text := p_method ->> 'type'; bad text[] := '{}'; spec text[] := '{}';
  groups constant text[] := array['Art', 'Handmade Crafts', 'Jewellery & Accessories', 'Festive & Home Decor', 'DIY Kits'];
  v_city text; v_state text; v_bio text; holder text;
begin
  if uid is null then perform public.fail('forbidden'); end if;
  if btrim(coalesce(p_legal_name, '')) = '' or char_length(p_legal_name) > 100 then bad := array_append(bad, 'legalName'); end if;
  if coalesce(p_pan, '') !~ '^[A-Z]{5}[0-9]{4}[A-Z]$' then bad := array_append(bad, 'pan'); end if;
  if t = 'upi' then
    if coalesce(p_method ->> 'upi', '') !~ '^[A-Za-z0-9_.-]{2,}@[A-Za-z0-9_]{2,}$' then bad := array_append(bad, 'upi'); end if;
    p_method := jsonb_build_object('type', 'upi', 'upi', p_method ->> 'upi');
  elsif t = 'bank' then
    holder := btrim(coalesce(p_method ->> 'holder', ''));
    if coalesce(p_method ->> 'account', '') !~ '^[0-9]{9,18}$' then bad := array_append(bad, 'account'); end if;
    if coalesce(p_method ->> 'ifsc', '') !~ '^[A-Z]{4}0[A-Z0-9]{6}$' then bad := array_append(bad, 'ifsc'); end if;
    if holder = '' or char_length(holder) > 100 then bad := array_append(bad, 'holder'); end if;
    p_method := jsonb_build_object('type', 'bank', 'account', p_method ->> 'account', 'ifsc', p_method ->> 'ifsc', 'holder', holder);
  else
    bad := array_append(bad, 'payoutMethod');
  end if;

  if p_profile is not null then
    v_city := btrim(coalesce(p_profile ->> 'city', '')); v_state := btrim(coalesce(p_profile ->> 'state', '')); v_bio := btrim(coalesce(p_profile ->> 'bio', ''));
    if v_city = '' or char_length(v_city) > 80 then bad := array_append(bad, 'city'); end if;
    if v_state = '' or char_length(v_state) > 80 then bad := array_append(bad, 'state'); end if;
    if v_bio = '' or char_length(v_bio) > 300 then bad := array_append(bad, 'bio'); end if;
    if jsonb_typeof(p_profile -> 'specialties') = 'array' then
      select coalesce(array_agg(distinct e), '{}') into spec from jsonb_array_elements_text(p_profile -> 'specialties') e;
    end if;
    if cardinality(spec) = 0 or not (spec <@ groups) then bad := array_append(bad, 'specialties'); end if;
    if (p_profile ->> 'ownWork') is distinct from 'true' then bad := array_append(bad, 'ownWork'); end if;
    if (p_profile ->> 'agreement') is distinct from 'true' then bad := array_append(bad, 'agreement'); end if;
  end if;
  if cardinality(bad) > 0 then perform public.fail('invalid', null, jsonb_build_object('fields', to_jsonb(bad))); end if;

  insert into public.artist_private (profile_id, legal_name, pan, payout_method, holder_name, verified_at)
  values (uid, btrim(p_legal_name), p_pan, p_method, holder, null)
  on conflict (profile_id) do update set legal_name = excluded.legal_name, pan = excluded.pan, payout_method = excluded.payout_method,
    holder_name = excluded.holder_name, verified_at = null;   -- any edit re-opens the Admin's check
  if p_profile is not null then
    update public.artist_private set specialties = spec, agreed_own_work_at = now(), agreed_terms_at = now(), submitted_at = now() where profile_id = uid;
    update public.profiles set city = v_city, state = v_state, bio = v_bio where id = uid;
  end if;
  update public.profiles set verified = false where id = uid;
  return '{}'::jsonb;
end $$;

-- 4. The fee in paise for the browser (the settings column itself stays hidden); null when it is zero.
create function public.onboarding_fee() returns bigint language sql stable security definer set search_path = '' as $$
  select nullif(onboarding_fee_paise, 0) from public.settings limit 1 $$;

-- 5. The only writer of "fee paid". Called by the Edge Function after the provider reports the payment captured for the exact amount.
create function public.record_fee_payment(p_order text, p_payment text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare fo public.fee_orders%rowtype; n integer;
begin
  select * into fo from public.fee_orders where razorpay_order_id = p_order for update;
  if not found then perform public.fail('conflict', 'not_found'); end if;
  if fo.payment_id is not null and fo.payment_id is distinct from p_payment then perform public.fail('conflict', 'order_already_paid'); end if;
  update public.fee_orders set payment_id = p_payment, paid_at = coalesce(paid_at, now()) where razorpay_order_id = p_order;
  insert into public.artist_private (profile_id, onboarding_order_id, onboarding_amount, onboarding_paid_at, onboarding_payment_id)
  values (fo.profile_id, fo.razorpay_order_id, fo.amount, now(), p_payment)
  on conflict (profile_id) do update set onboarding_order_id = excluded.onboarding_order_id, onboarding_amount = excluded.onboarding_amount,
    onboarding_paid_at = excluded.onboarding_paid_at, onboarding_payment_id = excluded.onboarding_payment_id
    where public.artist_private.onboarding_paid_at is null;
  get diagnostics n = row_count;
  if n = 1 then return jsonb_build_object('paid', true); end if;
  -- the fee was already recorded: this payment is the same one coming again, or a second one to refund
  if (select onboarding_payment_id from public.artist_private where profile_id = fo.profile_id) = p_payment then return jsonb_build_object('paid', true); end if;
  return jsonb_build_object('duplicate', true);
end $$;

-- 6. Grants.
revoke execute on function public.submit_verification(text, text, jsonb, jsonb), public.onboarding_fee(), public.record_fee_payment(text, text) from public, anon, authenticated;
grant execute on function public.submit_verification(text, text, jsonb, jsonb), public.onboarding_fee() to authenticated, service_role;
grant execute on function public.record_fee_payment(text, text) to service_role;
