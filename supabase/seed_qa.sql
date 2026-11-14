-- QA fixtures for the LOCAL stack only (docs/plans/craftme-screen-parity/QA/README.md). Run by `npm run db:seed` after `supabase db reset`:
--   psql -v qa_password=... -f seed_qa.sql      (the password comes from .env.e2e as QA_PASSWORD and is never stored here)
-- All names and amounts are test data. Never run this against the sandbox or production project.
-- P00 loads the people, the works W1 to W8, Order O2 and the settings row. Later packages add the other fixtures
-- (O1, O3 to O15, payouts, reports, the thirty filler works F01 to F30, saved address, notifications) with the screens that need them.
\set ON_ERROR_STOP on

-- Tests move time by editing rows and calling public.sweep() themselves, so the scheduled jobs stay off locally.
select cron.unschedule(jobname) from cron.job where jobname like 'craftme-%';

-- ---------- re-runnable: remove the previous fixtures and everything the tests made with them ----------
-- (a full `supabase db reset` takes a minute; this takes a second, so each spec file can start clean)
create temp table qa_old as select id from auth.users where email like '%@craftme.test';
create temp table qa_old_orders as select id from public.orders where buyer_id in (select id from qa_old) or artist_id in (select id from qa_old);
update public.orders set payout_id = null where id in (select id from qa_old_orders);
delete from public.payouts where artist_id in (select id from qa_old);
delete from public.reviews where order_id in (select id from qa_old_orders);
delete from public.refunds where order_id in (select id from qa_old_orders);
delete from public.damage_reports where order_id in (select id from qa_old_orders);
delete from public.orders where id in (select id from qa_old_orders); -- lines and shipping cascade
delete from public.reports where reporter_id in (select id from qa_old);
delete from public.requests where user_id in (select id from qa_old);
delete from public.processed_events;
delete from public.listings where artist_id in (select id from qa_old);
delete from public.artworks where artist_id in (select id from qa_old);
delete from public.deletion_requests where user_id in (select id from qa_old);
delete from public.profiles where id in (select id from qa_old); -- private rows, notifications, wish lists, reels, saved address cascade
delete from auth.users where id in (select id from qa_old);       -- identities and saved carts cascade

-- ---------- people: key -> fixed id (mirrored in e2e/helpers/ids.js) ----------
create temp table qa_people (key text, id uuid, email text, name text, meta jsonb);
insert into qa_people values
  ('B1',  'b1000000-0000-4000-8000-000000000001', 'b1@craftme.test',  'Ananya Verma',  '{}'),
  ('B2',  'b2000000-0000-4000-8000-000000000002', 'b2@craftme.test',  'Rahul Nair',    '{}'),
  ('A1',  'a1000000-0000-4000-8000-000000000001', 'a1@craftme.test',  'Meera Iyer',    '{"artist": true}'),
  ('A2',  'a2000000-0000-4000-8000-000000000002', 'a2@craftme.test',  'Imran Sheikh',  '{}'),
  ('A3',  'a3000000-0000-4000-8000-000000000003', 'a3@craftme.test',  'Naina Kapoor',  '{"artist": true}'),
  ('A4',  'a4000000-0000-4000-8000-000000000004', 'a4@craftme.test',  'Tanvi Rao',     '{"artist": true}'),
  ('AD1', 'ad000000-0000-4000-8000-000000000001', 'ad1@craftme.test', 'Admin One',     '{"admin": true}'),
  ('AD2', 'ad000000-0000-4000-8000-000000000002', 'ad2@craftme.test', 'Admin Two',     '{"admin": true}');

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email, crypt(:'qa_password', gen_salt('bf')), now(),
       '{"provider": "email", "providers": ["email"]}'::jsonb || meta, jsonb_build_object('full_name', name), now(), now(), '', '', '', ''
from qa_people;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, id::text, jsonb_build_object('sub', id::text, 'email', email), 'email', now(), now(), now()
from qa_people;

-- profiles exist already (the signup trigger made them); set roles and state
update public.profiles p set roles = array(select jsonb_object_keys(q.meta))
  from qa_people q where q.id = p.id and q.meta <> '{}';
update public.profiles set roles = '{artist}' where id = 'a2000000-0000-4000-8000-000000000002'; -- A2 applied but is not verified: no artist claim yet
update public.profiles set restricted = true where id = 'a3000000-0000-4000-8000-000000000003';   -- before A3's works, so they start hidden
update public.profiles set bio = 'Chennai painter of monsoon skies and temple tanks.', rating_sum = 14, rating_count = 3, rating_avg = 4.67
  where id = 'a1000000-0000-4000-8000-000000000001';

insert into public.artist_private (profile_id, legal_name, pan, phone_verified, verified_at, onboarding_paid_at, amount_owed, restriction_reasons) values
  ('a1000000-0000-4000-8000-000000000001', 'Meera Iyer',   'ABCDE1234F', true,  now(), now(), 0, '{}'),
  ('a2000000-0000-4000-8000-000000000002', 'Imran Sheikh', 'ABCDE1235G', true,  null,  now(), 0, '{}'),
  ('a3000000-0000-4000-8000-000000000003', 'Naina Kapoor', 'ABCDE1236H', true,  now(), now(), 320000, '{owed_60_days}'),
  ('a4000000-0000-4000-8000-000000000004', 'Tanvi Rao',    'ABCDE1237J', true,  now(), now(), 320000, '{}');

-- ---------- works W1 to W8 (fixed ids W1.. = c1000000-...-00000000000N) ----------
insert into public.artworks (id, artist_id, title, description, category, photos, status) values
  ('c1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'Monsoon Over Marina',     'Oil on canvas, Marina Beach before the rain.', 'Paintings',    array['/demo/rajasthani-women.jpg','/demo/radha-krishna-flute.jpg','/demo/madhubani-fish.jpg'], 'published'),
  ('c1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'Kolam at Dawn',           'A kolam drawn in rice flour at first light.',   'Drawings',     array['/demo/madhubani-fish.jpg'], 'published'),
  ('c1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001', 'Temple Tank, Evening',    'The temple tank at dusk.',                      'Paintings',    array['/demo/banyan-golden-hour.jpg'], 'published'),
  ('c1000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000001', 'Coconut Grove, Study 2',  'A study, not yet published.',                   'Paintings',    array['/demo/peacock-mandala.jpg'], 'draft'),
  ('c1000000-0000-4000-8000-000000000005', 'a1000000-0000-4000-8000-000000000001', 'Pongal Morning',         'Print run ended.',                              'Art Prints',   array['/demo/peacock-mandala.jpg'], 'published'),
  ('c1000000-0000-4000-8000-000000000006', 'a2000000-0000-4000-8000-000000000002', 'Brass Heron',            'A heron cast in brass.',                        'Sculptures',   array['/demo/dokra-elephant.jpg'], 'published'),
  ('c1000000-0000-4000-8000-000000000007', 'a3000000-0000-4000-8000-000000000003', 'Peacock Study',          'Hidden while the artist is restricted.',        'Paintings',    array['/demo/peacock-mandala.jpg'], 'published'),
  ('c1000000-0000-4000-8000-000000000008', 'a4000000-0000-4000-8000-000000000004', 'Riso Sunrise',           'Two-colour riso print.',                        'Art Prints',   array['/demo/banyan-golden-hour.jpg'], 'published');

-- listings: price in paise. Ids L<work><n> = d<work>000000-...
insert into public.listings (id, artwork_id, artist_id, title, kind, price, stock, status) values
  ('d1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'Original', 'original', 4200000, 1,  'live'),
  ('d1000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'Print',    'print',     250000, 50, 'live'),
  ('d2000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'Original', 'original', 1800000, 0,  'sold'),
  ('d2000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'Print',    'print',     220000, 12, 'live'),
  ('d3000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001', 'Original', 'original', 3000000, 0,  'sold'),
  ('d5000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000005', 'a1000000-0000-4000-8000-000000000001', 'Print',    'print',     150000, 5,  'ended'),
  ('d6000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000006', 'a2000000-0000-4000-8000-000000000002', 'Original', 'original', 2800000, 1,  'live'),
  ('d7000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000007', 'a3000000-0000-4000-8000-000000000003', 'Original', 'original', 2000000, 1,  'live'),
  ('d8000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000008', 'a4000000-0000-4000-8000-000000000004', 'Print',    'print',     180000, 40, 'live'),
  ('d8000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000008', 'a4000000-0000-4000-8000-000000000004', 'Ready-made frame', 'product', 90000, 5, 'live');

-- ---------- Order O2: B1 bought from A1, paid today (W2 Print x2 and W1 Print x1 = 690000 paise) ----------
insert into public.orders (id, code, buyer_id, artist_id, total, stage, created_at, paid_at, ship_by, razorpay_order_id, razorpay_payment_id, gateway_fee)
values ('e2000000-0000-4000-8000-000000000002', 'CM-20402', 'b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 690000, 'paid',
        now(), now(), now() + interval '7 days', 'order_fake_qa_o2', 'pay_fake_ok_order_fake_qa_o2', 16284);
insert into public.order_lines (order_id, listing_id, artwork_id, title, kind, unit_paise, quantity) values
  ('e2000000-0000-4000-8000-000000000002', 'd2000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000002', 'Kolam at Dawn',       'print', 220000, 2),
  ('e2000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000001', 'Monsoon Over Marina', 'print', 250000, 1);
insert into public.order_shipping (order_id, name, phone, address, city, state, pin) values
  ('e2000000-0000-4000-8000-000000000002', 'Ananya Verma', '9876543210', '12 Carter Road', 'Mumbai', 'Maharashtra', '400050');
update public.orders set payment_method = 'upi', commission_bps = 1000, gift_note = 'Happy birthday' where id = 'e2000000-0000-4000-8000-000000000002';

-- ---------- P01: B1's saved address, filler work F01, and orders O1, O3 to O10, O14 (ids e0000000-…-0000000000NN) ----------
insert into public.saved_addresses (user_id, name, phone, address, address2, landmark, city, state, pin) values
  ('b1000000-0000-4000-8000-000000000001', 'Ananya Verma', '9876543210', 'Flat 402, Sea Breeze Apartments', 'Carter Road, Bandra West', '', 'Mumbai', 'Maharashtra', '400050');

-- P03: thirty filler works F01 to F30 (F01 stays Artist A1's, used by the saved-cart tests). Six share one timestamp; F11 to F14 share one price.
-- A1's fillers are Ready-made so A1's Prints and Originals stay W1 and W2 only.
create temp table qa_filler as
select n, case when n = 1 or n % 3 = 0 then 'a1000000-0000-4000-8000-000000000001'::uuid when n % 3 = 1 then 'a2000000-0000-4000-8000-000000000002'::uuid
               else 'a4000000-0000-4000-8000-000000000004'::uuid end as artist,
       (array['Paintings', 'Wood Crafts', 'Keychains', 'Wall Hangings', 'Bead & Charm Kits'])[n % 5 + 1] as category
from generate_series(1, 30) n;
insert into public.artworks (id, artist_id, title, description, category, photos, status, created_at, medium)
select ('cf000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, artist, 'Filler ' || lpad(n::text, 2, '0'), 'Filler work F' || lpad(n::text, 2, '0') || '.', category,
       array['/demo/madhubani-fish.jpg'], 'published',
       case when n <= 6 then now() - interval '1 day' else now() - interval '2 days' - n * interval '1 hour' end,
       case when n % 7 = 0 then 'Acrylic on board' else '' end
from qa_filler;
insert into public.listings (id, artwork_id, artist_id, title, kind, price, stock, status)
select ('df000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, ('cf000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, artist,
       case when artist = 'a1000000-0000-4000-8000-000000000001' or category <> 'Paintings' then 'Ready-made' else 'Print' end,
       case when artist = 'a1000000-0000-4000-8000-000000000001' or category <> 'Paintings' then 'product' else 'print' end,
       case when n = 1 then 50000 when n between 11 and 14 then 99900 else (500 + (n - 1) * 2050) * 100 end, 10, 'live'
from qa_filler;

-- helper: one order with its lines and address. p_lines: [{listing, artwork, title, kind, unit, qty, refunded}]
create function pg_temp.qa_order(p_id uuid, p_code text, p_buyer uuid, p_artist uuid, p_stage text, p_lines jsonb, p_times jsonb, p_extra jsonb default '{}')
returns void language plpgsql as $$
declare l jsonb; total bigint := 0;
begin
  for l in select * from jsonb_array_elements(p_lines) loop total := total + (l->>'unit')::bigint * (l->>'qty')::int; end loop;
  insert into public.orders (id, code, buyer_id, artist_id, total, stage, created_at, hold_until, paid_at, ship_by, shipped_at, auto_receive_at,
    received_at, damage_window_ends, review_by, razorpay_order_id, razorpay_payment_id, gateway_fee, commission_bps, payment_method,
    courier, tracking_number, refunded_total, payable, reviewed, overdue, open_report, damage_reported)
  values (p_id, p_code, p_buyer, p_artist, total, p_stage,
    now() + coalesce((p_times->>'created')::interval, (p_times->>'paid')::interval, interval '0'),
    now() + (p_times->>'hold')::interval,
    now() + (p_times->>'paid')::interval, now() + (p_times->>'paid')::interval + interval '7 days',
    now() + (p_times->>'shipped')::interval, now() + (p_times->>'shipped')::interval + interval '14 days',
    now() + (p_times->>'received')::interval, now() + (p_times->>'received')::interval + interval '3 days',
    now() + (p_times->>'received')::interval + interval '30 days',
    'order_fake_qa_' || lower(p_code), case when p_times ? 'paid' then 'pay_fake_ok_order_fake_qa_' || lower(p_code) end,
    case when p_times ? 'paid' then round(total * 0.0236) else 0 end, case when p_times ? 'paid' then 1000 end,
    case when p_times ? 'paid' then 'upi' end,
    case when p_times ? 'shipped' then coalesce(p_extra->>'courier', 'DTDC') end, case when p_times ? 'shipped' then coalesce(p_extra->>'tracking', 'DT' || right(p_code, 5) || 'IN') end,
    coalesce((p_extra->>'refunded')::bigint, 0), coalesce((p_extra->>'payable')::boolean, false), coalesce((p_extra->>'reviewed')::boolean, false),
    coalesce((p_extra->>'overdue')::boolean, false), coalesce((p_extra->>'open_report')::boolean, false), coalesce((p_extra->>'open_report')::boolean, false));
  insert into public.order_lines (order_id, listing_id, artwork_id, title, kind, unit_paise, quantity, refunded_quantity)
  select p_id, (x->>'listing')::uuid, (x->>'artwork')::uuid, x->>'title', x->>'kind', (x->>'unit')::bigint, (x->>'qty')::int, coalesce((x->>'refunded')::int, 0)
  from jsonb_array_elements(p_lines) x;
  insert into public.order_shipping (order_id, name, phone, address, address2, city, state, pin)
  select p_id, p.display_name, '9876543210', '12 Carter Road', 'Bandra West', 'Mumbai', 'Maharashtra', '400050' from public.profiles p where p.id = p_buyer;
end $$;

-- W1 Print, W2 Print, W6 Original, as order lines
\set w1p '{"listing":"d1000000-0000-4000-8000-000000000002","artwork":"c1000000-0000-4000-8000-000000000001","title":"Monsoon Over Marina","kind":"print","unit":250000,"qty":1}'
\set w2p '{"listing":"d2000000-0000-4000-8000-000000000002","artwork":"c1000000-0000-4000-8000-000000000002","title":"Kolam at Dawn","kind":"print","unit":220000,"qty":1}'
\set w6o '{"listing":"d6000000-0000-4000-8000-000000000001","artwork":"c1000000-0000-4000-8000-000000000006","title":"Brass Heron","kind":"original","unit":2800000,"qty":1}'

select pg_temp.qa_order('e0000000-0000-4000-8000-000000000001', 'CM-20401', 'b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'hold',
  jsonb_build_array(:'w1p'::jsonb), '{"hold": "10 minutes", "created": "-5 minutes"}');
update public.listings set held = held + 1 where id = 'd1000000-0000-4000-8000-000000000002'; -- O1 holds one W1 Print
select pg_temp.qa_order('e0000000-0000-4000-8000-000000000003', 'CM-20403', 'b2000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'paid',
  jsonb_build_array(:'w2p'::jsonb), '{"paid": "-8 days"}', '{"overdue": true}');
select pg_temp.qa_order('e0000000-0000-4000-8000-000000000004', 'CM-20404', 'b1000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000002', 'shipped',
  jsonb_build_array(:'w6o'::jsonb), '{"paid": "-3 days", "shipped": "-2 days"}', '{"tracking": "DT4830012IN"}');
select pg_temp.qa_order('e0000000-0000-4000-8000-000000000005', 'CM-20405', 'b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'received',
  jsonb_build_array(:'w2p'::jsonb, :'w1p'::jsonb), '{"paid": "-6 days", "shipped": "-4 days", "received": "-1 day"}');
select pg_temp.qa_order('e0000000-0000-4000-8000-000000000006', 'CM-20406', 'b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'received',
  jsonb_build_array(:'w2p'::jsonb), '{"paid": "-15 days", "shipped": "-13 days", "received": "-10 days"}', '{"payable": true}');
select pg_temp.qa_order('e0000000-0000-4000-8000-000000000007', 'CM-20407', 'b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'received',
  jsonb_build_array(:'w1p'::jsonb), '{"paid": "-45 days", "shipped": "-43 days", "received": "-40 days"}', '{"payable": true, "reviewed": true}');
select pg_temp.qa_order('e0000000-0000-4000-8000-000000000008', 'CM-20408', 'b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'received',
  jsonb_build_array(:'w2p'::jsonb || '{"refunded": 1}', :'w1p'::jsonb), '{"paid": "-9 days", "shipped": "-8 days", "received": "-2 days"}', '{"refunded": 220000}');
select pg_temp.qa_order('e0000000-0000-4000-8000-000000000009', 'CM-20409', 'b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'refunded',
  jsonb_build_array(:'w1p'::jsonb || '{"refunded": 1}'), '{"paid": "-20 days", "shipped": "-18 days", "received": "-15 days"}', '{"refunded": 250000}');
select pg_temp.qa_order('e0000000-0000-4000-8000-000000000010', 'CM-20410', 'b2000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'received',
  jsonb_build_array(:'w2p'::jsonb, :'w1p'::jsonb), '{"paid": "-5 days", "shipped": "-3 days", "received": "-1 day"}', '{"open_report": true}');
select pg_temp.qa_order('e0000000-0000-4000-8000-000000000014', 'CM-20414', 'b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'shipped',
  jsonb_build_array(:'w2p'::jsonb), '{"paid": "-16 days", "shipped": "-15 days"}');

insert into public.refunds (order_id, buyer_id, artist_id, amount, reason, lines, razorpay_refund_id, status, created_at) values
  ('e0000000-0000-4000-8000-000000000008', 'b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 220000,
   'The print arrived damaged', '[{"lineId": "d2000000-0000-4000-8000-000000000002", "quantity": 1}]', 'rfnd_fake_qa_o8', 'issued', now() - interval '1 day'),
  ('e0000000-0000-4000-8000-000000000009', 'b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 250000,
   'The print arrived damaged', '[{"lineId": "d1000000-0000-4000-8000-000000000002", "quantity": 1}]', 'rfnd_fake_qa_o9', 'issued', now() - interval '12 days');
insert into public.damage_reports (order_id, buyer_id, artist_id, photos, note, status, line_ids) values
  ('e0000000-0000-4000-8000-000000000010', 'b2000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001',
   '{damage/b2000000-0000-4000-8000-000000000002/1.jpg,damage/b2000000-0000-4000-8000-000000000002/2.jpg}', 'The corner is torn.', 'open',
   '{d2000000-0000-4000-8000-000000000002}');

-- P02: O7's approved Review (QA-S15-04)
insert into public.reviews (order_id, artist_id, buyer_id, rating, comment, status, buyer_name, created_at) values
  ('e0000000-0000-4000-8000-000000000007', 'a1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 5,
   'Beautiful print, packed with care.', 'approved', 'Ananya', now() - interval '35 days');

update public.settings set commission_bps = 1000, onboarding_fee_paise = 49900,
  switches = '{"acceptArtists": true, "instagramConnect": true, "demoBanner": true, "emails": false}';

-- ---------- P03: where the Artists are, wall labels, A1's public Reviews and reel ----------
update public.profiles set city = 'Chennai', state = 'Tamil Nadu', verified = true where id = 'a1000000-0000-4000-8000-000000000001';
update public.profiles set city = 'Lucknow', state = 'Uttar Pradesh' where id = 'a2000000-0000-4000-8000-000000000002';
update public.profiles set verified = true where id in ('a3000000-0000-4000-8000-000000000003', 'a4000000-0000-4000-8000-000000000004');
update public.artworks set medium = 'Acrylic on canvas', year = 2024, signed = 'back' where id = 'c1000000-0000-4000-8000-000000000001';
update public.artworks set medium = 'Rice flour on paper', year = 2025, signed = 'unsigned' where id = 'c1000000-0000-4000-8000-000000000002';
update public.artworks set medium = 'Cast brass', year = 2023 where id = 'c1000000-0000-4000-8000-000000000006';
update public.artworks set medium = 'Two-colour riso print' where id = 'c1000000-0000-4000-8000-000000000008';

-- A1's three approved Reviews (O7 already has one): 5, 5 and 4 stars = the profile's stored 14 over 3.
-- The two extra Reviews hang on two received Orders of Admin Two (a buyer no other script counts), so O9, O10 and the review scripts stay as they are.
select pg_temp.qa_order('e0000000-0000-4000-8000-000000000016', 'CM-20416', 'ad000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'received',
  jsonb_build_array(:'w1p'::jsonb), '{"paid": "-20 days", "shipped": "-18 days", "received": "-15 days"}');
select pg_temp.qa_order('e0000000-0000-4000-8000-000000000017', 'CM-20417', 'ad000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'received',
  jsonb_build_array(:'w2p'::jsonb), '{"paid": "-8 days", "shipped": "-6 days", "received": "-4 days"}');
insert into public.reviews (order_id, artist_id, buyer_id, rating, comment, status, buyer_name, created_at) values
  ('e0000000-0000-4000-8000-000000000016', 'a1000000-0000-4000-8000-000000000001', 'ad000000-0000-4000-8000-000000000002', 5,
   'Exactly as photographed, and it arrived in three days.', 'approved', 'Ananya', now() - interval '12 days'),
  ('e0000000-0000-4000-8000-000000000017', 'a1000000-0000-4000-8000-000000000001', 'ad000000-0000-4000-8000-000000000002', 4,
   'Lovely colours. The tube was a little dented but the print was fine.', 'approved', 'Rahul', now() - interval '3 days');
update public.orders set reviewed = true where id in ('e0000000-0000-4000-8000-000000000016', 'e0000000-0000-4000-8000-000000000017');

insert into public.reels (id, artist_id, url, highlighted, position, owner_confirmed) values
  ('ee000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'https://www.instagram.com/reel/CqaQa123abc/', true, 0, true);
update public.artworks set reel_id = 'ee000000-0000-4000-8000-000000000001' where id = 'c1000000-0000-4000-8000-000000000001';
