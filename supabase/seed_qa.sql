-- QA fixtures for the LOCAL stack only (docs/plans/craftme-screen-parity/QA/README.md). Run by `npm run db:seed` after `supabase db reset`:
--   psql -v qa_password=... -f seed_qa.sql      (the password comes from .env.e2e as QA_PASSWORD and is never stored here)
-- All names and amounts are test data. Never run this against the sandbox or production project.
-- P00 loads the people, the works W1 to W8, Order O2 and the settings row. Later packages add the other fixtures
-- (O1, O3 to O15, payouts, reports, the thirty filler works F01 to F30, saved address, notifications) with the screens that need them.
\set ON_ERROR_STOP on

-- ---------- people: key -> fixed id (mirrored in e2e/helpers/ids.js) ----------
create temp table qa_people (key text, id uuid, email text, name text, meta jsonb) on commit drop;
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

update public.settings set commission_bps = 1000, onboarding_fee_paise = 49900,
  switches = '{"acceptArtists": true, "instagramConnect": true, "demoBanner": true, "emails": false}';
