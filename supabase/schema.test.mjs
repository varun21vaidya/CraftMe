import {PGlite} from "@electric-sql/pglite";
import fs from "node:fs";

const db = new PGlite();
const migrations = ["0001_init", "0002_hardening", "0003_logic", "0006_catalogue", "0008_reels", "0009_instagram", "0011_instagram_unified", "0013_service_role_grants", "0014_reel_title"].map((n) => fs.readFileSync(new URL(`./migrations/${n}.sql`, import.meta.url), "utf8"));

// Minimal stand-ins for what Supabase provides.
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), raw_user_meta_data jsonb default '{}');
  create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on all functions in schema auth to anon, authenticated, service_role;
`);
for (const sql of migrations) await db.exec(sql);
console.log("migrations applied");

let pass = 0, fail = 0;
const as = async (role, claims, fn) => {
  await db.exec(`set role ${role}; select set_config('request.jwt.claims', '${JSON.stringify(claims)}', false);`);
  try { return await fn(); } finally { await db.exec("reset role"); }
};
const ok = (name, cond) => { cond ? pass++ : fail++; console.log((cond ? "PASS " : "FAIL ") + name); };
const rejects = async (name, fn) => { try { await fn(); ok(name, false); } catch (e) { ok(name + "  [" + e.message.split("\n")[0].slice(0, 70) + "]", true); } };

const artist = "11111111-1111-1111-1111-111111111111";
const buyer = "22222222-2222-2222-2222-222222222222";
const other = "33333333-3333-3333-3333-333333333333";
await db.exec(`insert into auth.users (id, raw_user_meta_data) values ('${artist}', '{"full_name":"Meera"}'), ('${buyer}', '{}'), ('${other}', '{}')`);
ok("signup trigger made profiles", (await db.query("select count(*)::int n from public.profiles")).rows[0].n === 3);

const A = {sub: artist, app_metadata: {artist: true}};
const B = {sub: buyer, app_metadata: {}};
const O = {sub: other, app_metadata: {}};

// Artist: draft artwork ok, cannot self-publish on insert, cannot insert for someone else.
let artId;
await as("authenticated", A, async () => {
  artId = (await db.query(`insert into public.artworks (artist_id, title, category, status) values ('${artist}', 'Warli', 'Paintings', 'draft') returning id`)).rows[0].id;
  ok("artist creates a draft artwork", !!artId);
});
await as("authenticated", A, () => rejects("artist cannot insert a published artwork", () =>
  db.query(`insert into public.artworks (artist_id, title, category, status) values ('${artist}', 'X', 'Paintings', 'published')`)));
await as("authenticated", A, () => rejects("artist cannot insert as another artist", () =>
  db.query(`insert into public.artworks (artist_id, title, category, status) values ('${buyer}', 'X', 'Paintings', 'draft')`)));
await as("authenticated", B, () => rejects("non-artist cannot insert an artwork", () =>
  db.query(`insert into public.artworks (artist_id, title, category, status) values ('${buyer}', 'X', 'Paintings', 'draft')`)));
await as("authenticated", A, () => rejects("artist cannot write has_sales", () =>
  db.query(`update public.artworks set has_sales = true where id = '${artId}'`)));

// Publishing, then public visibility.
await as("authenticated", A, () => db.query(`update public.artworks set status = 'published', description = 'hi' where id = '${artId}'`));
await db.exec(`update public.artworks set available = true, from_price_paise = 100000 where id = '${artId}'`); // server side
await as("anon", {}, async () => ok("anon sees the published artwork", (await db.query("select count(*)::int n from public.artworks")).rows[0].n === 1));
await as("authenticated", A, () => db.query(`update public.artworks set status = 'draft' where id = '${artId}'`));
await as("anon", {}, async () => ok("anon no longer sees it as a draft", (await db.query("select count(*)::int n from public.artworks")).rows[0].n === 0));

// Listings: constraints and column limits.
let lid;
await as("authenticated", A, async () => {
  lid = (await db.query(`insert into public.listings (artwork_id, artist_id, kind, price, stock, status) values ('${artId}', '${artist}', 'original', 500000, 1, 'draft') returning id`)).rows[0].id;
  ok("artist creates a draft listing", !!lid);
});
await as("authenticated", A, () => rejects("an Original cannot have stock 2", () =>
  db.query(`insert into public.listings (artwork_id, artist_id, kind, price, stock, status) values ('${artId}', '${artist}', 'original', 500000, 2, 'draft')`)));
await as("authenticated", A, () => rejects("price below 100 paise rejected", () =>
  db.query(`insert into public.listings (artwork_id, artist_id, kind, price, stock, status) values ('${artId}', '${artist}', 'print', 50, 5, 'draft')`)));
await as("authenticated", A, () => rejects("a new listing needs stock of at least 1", () =>
  db.query(`insert into public.listings (artwork_id, artist_id, kind, price, stock, status) values ('${artId}', '${artist}', 'print', 500000, 0, 'draft')`)));
ok("a 'product' listing accepts stock above 1", !!(await db.query(`insert into public.listings (artwork_id, artist_id, kind, price, stock, status) values ('${artId}', '${artist}', 'product', 50000, 8, 'draft') returning id`)).rows[0].id);
await rejects("an old category name is refused", () => db.query(`insert into public.artworks (artist_id, title, category, status) values ('${artist}', 'X', 'Painting', 'draft')`));
const theirArt = (await db.query(`insert into public.artworks (artist_id, title, category, status) values ('${buyer}', 'Not yours', 'Paintings', 'published') returning id`)).rows[0].id;
await as("authenticated", A, () => rejects("artist cannot list on another artist's artwork", () =>
  db.query(`insert into public.listings (artwork_id, artist_id, kind, price, stock, status) values ('${theirArt}', '${artist}', 'print', 500000, 5, 'draft')`)));
await db.exec(`delete from public.artworks where id = '${theirArt}'`); // keep later anon counts unchanged
await as("authenticated", A, () => rejects("artist cannot edit stock", () => db.query(`update public.listings set stock = 5 where id = '${lid}'`)));
await as("authenticated", A, () => rejects("artist cannot mark a listing sold", () => db.query(`update public.listings set status = 'sold' where id = '${lid}'`)));
await rejects("held cannot exceed stock (even for the server)", () => db.query(`update public.listings set held = 2 where id = '${lid}'`));

// Orders: no client writes; visibility by party.
await db.exec(`update public.listings set status='live' where id='${lid}'`);
const oid = (await db.query(`insert into public.orders (code, buyer_id, artist_id, total, stage) values ('ABC123','${buyer}','${artist}',500000,'paid') returning id`)).rows[0].id;
await db.exec(`insert into public.order_shipping (order_id, name, phone, address, city, state, pin) values ('${oid}','B','9876543210','1 Road','Pune','MH','411001')`);
await as("authenticated", B, () => rejects("buyer cannot insert an order", () =>
  db.query(`insert into public.orders (code, buyer_id, artist_id, total, stage) values ('X','${buyer}','${artist}',1,'paid')`)));
await as("authenticated", B, () => rejects("buyer cannot change the stage", () => db.query(`update public.orders set stage='received' where id='${oid}'`)));
await as("authenticated", B, async () => ok("buyer sees own order", (await db.query("select count(*)::int n from public.orders")).rows[0].n === 1));
await as("authenticated", O, async () => ok("stranger sees no orders", (await db.query("select count(*)::int n from public.orders")).rows[0].n === 0));
await as("authenticated", A, async () => ok("artist sees address once paid", (await db.query("select count(*)::int n from public.order_shipping")).rows[0].n === 1));
await db.exec(`update public.orders set stage='hold' where id='${oid}'`);
await as("authenticated", A, async () => ok("artist cannot see address while on hold", (await db.query("select count(*)::int n from public.order_shipping")).rows[0].n === 0));
await rejects("buyer cannot buy own work", () => db.query(`insert into public.orders (code, buyer_id, artist_id, total, stage) values ('Z','${buyer}','${buyer}',1,'hold')`));
await rejects("refund cannot exceed total", () => db.query(`update public.orders set refunded_total = 600000 where id='${oid}'`));

// Profiles, secrets, settings, system tables.
await as("authenticated", B, async () => {
  await db.query(`update public.profiles set bio = 'hello', instagram_handle = 'meera_art' where id = '${buyer}'`);
  ok("user edits own bio and handle", true);
});
await as("authenticated", B, () => rejects("bad Instagram handle rejected", () => db.query(`update public.profiles set instagram_handle = 'a b!' where id = '${buyer}'`)));
await as("authenticated", B, () => rejects("user cannot grant self a role", () => db.query(`update public.profiles set roles = '{artist}' where id = '${buyer}'`)));
await as("authenticated", B, async () => {
  await db.query(`update public.profiles set display_name = 'x' where id = '${other}'`);
  ok("editing someone else's profile changes 0 rows", (await db.query(`select display_name from public.profiles where id = '${other}'`)).rows[0].display_name === "");
});
await db.exec(`insert into public.artist_private (profile_id, legal_name, pan) values ('${artist}', 'Meera I', 'ABCDE1234F')`);
await as("authenticated", B, async () => ok("buyer sees no artist_private rows", (await db.query("select count(*)::int n from public.artist_private")).rows[0].n === 0));
await as("authenticated", A, async () => ok("artist sees own artist_private row", (await db.query("select count(*)::int n from public.artist_private")).rows[0].n === 1));
await as("authenticated", {sub: other, app_metadata: {admin: true}}, async () => ok("admin sees artist_private", (await db.query("select count(*)::int n from public.artist_private")).rows[0].n === 1));
await as("anon", {}, () => rejects("anon cannot read the commission", () => db.query("select commission_bps from public.settings")));
await as("anon", {}, async () => ok("anon can read public switches", (await db.query("select switches from public.settings")).rows.length === 1));
await as("authenticated", B, () => rejects("client cannot touch requests table", () => db.query("select * from public.requests")));
await as("service_role", {}, async () => ok("service role reads orders", (await db.query("select count(*)::int n from public.orders")).rows[0].n === 1));

// ---------- business logic (0003) ----------
const failsWith = async (name, text, fn) => {
  try { await fn(); ok(name, false); } catch (e) { ok(name + "  [" + e.message.slice(0, 60) + "]", e.message.includes(text)); }
};
const svc = (fn) => as("service_role", {}, fn);
const one = async (sqlText) => (await db.query(sqlText)).rows[0];
const admin = {sub: other, app_metadata: {admin: true}};
const addr = JSON.stringify({name: "B", phone: "9876543210", address: "1 Road", city: "Pune", state: "MH", pin: "411001"});
const art2 = (await one(`insert into public.artworks (artist_id, title, category, status) values ('${artist}', 'Flow', 'Paintings', 'published') returning id`)).id;
const lp = (await one(`insert into public.listings (artwork_id, artist_id, title, kind, price, stock, status) values ('${art2}','${artist}','Print','print',100000,3,'live') returning id`)).id;
const lo = (await one(`insert into public.listings (artwork_id, artist_id, title, kind, price, stock, status) values ('${art2}','${artist}','Orig','original',500000,1,'live') returning id`)).id;
ok("listing trigger sets from price on the artwork", Number((await one(`select from_price_paise p from public.artworks where id='${art2}'`)).p) === 100000);
const lines = (qty, seen) => JSON.stringify([{listingId: lp, quantity: qty, ...(seen ? {seenUnitPaise: seen} : {})}]);
const place = (b, a, l) => `select public.place_order('${b}','${a}','${l}','${addr}') r`;

await as("authenticated", B, () => rejects("a buyer cannot call place_order directly", () => db.query(place(buyer, artist, lines(1)))));
const placed = await svc(async () => (await one(place(buyer, artist, lines(2)))).r);
ok("place_order holds stock and totals the order", Number(placed.amount) === 200000 && (await one(`select held from public.listings where id='${lp}'`)).held === 2);
await svc(() => failsWith("cannot hold more than the free stock", "sold", () => db.query(place(other, artist, lines(2)))));
await svc(() => failsWith("a changed price is reported", "price_changed", () => db.query(place(other, artist, lines(1, 90000)))));
ok("a refused order leaves no hold behind", (await one(`select held from public.listings where id='${lp}'`)).held === 2);
await svc(() => failsWith("cannot buy your own work", "own_listing", () => db.query(place(artist, artist, lines(1)))));

const paid1 = await svc(async () => (await one(`select public.mark_paid('${placed.orderId}', 'pay_1', 2360) r`)).r);
ok("mark_paid moves the stock from held to sold", paid1.stage === "paid" && (await one(`select stock, held from public.listings where id='${lp}'`)).stock === 1);
const paid2 = await svc(async () => (await one(`select public.mark_paid('${placed.orderId}', 'pay_1', 2360) r`)).r);
ok("mark_paid twice changes nothing", paid2.stage === "paid" && (await one(`select stock from public.listings where id='${lp}'`)).stock === 1);
ok("paying notified the buyer and the artist", (await one(`select count(*)::int n from public.notifications where type in ('order_paid','order_new')`)).n === 2);

await as("authenticated", O, () => failsWith("a stranger cannot ship", "forbidden", () => db.query(`select public.mark_shipped('${placed.orderId}', 'DTDC')`)));
await as("authenticated", A, () => failsWith("an artist must name a courier", "invalid", () => db.query(`select public.mark_shipped('${placed.orderId}', '  ')`)));
await as("authenticated", A, async () => { await db.query(`select public.mark_shipped('${placed.orderId}', 'DTDC', 'T1')`); ok("artist ships a paid order", true); });
await as("authenticated", B, () => failsWith("cannot report damage before receiving", "wrong_stage", () => db.query(`select public.report_damage('${placed.orderId}', '{${lp}}', 'broken', '{}')`)));
await as("authenticated", B, async () => { await db.query(`select public.confirm_received('${placed.orderId}')`); ok("buyer confirms receipt", true); });
await as("authenticated", B, () => failsWith("damage photos must be in the buyer's own folder", "photoPaths", () => db.query(`select public.report_damage('${placed.orderId}', '{${lp}}', 'cracked', '{damage/${other}/x.jpg}')`)));
await as("authenticated", B, async () => { await db.query(`select public.report_damage('${placed.orderId}', '{${lp}}', 'cracked', '{damage/${buyer}/x.jpg}')`); ok("buyer reports damage in the window", true); });
await as("authenticated", B, () => failsWith("a second damage report is refused", "already_exists", () => db.query(`select public.report_damage('${placed.orderId}', '{${lp}}', 'again', '{}')`)));
await as("authenticated", B, async () => { await db.query(`select public.submit_review('${placed.orderId}', 5, 'lovely')`); ok("buyer reviews a received order", true); });
await as("authenticated", B, () => failsWith("a second review is refused", "already_exists", () => db.query(`select public.submit_review('${placed.orderId}', 4, 'again')`)));
await as("authenticated", B, () => failsWith("a buyer cannot decide a review", "forbidden", () => db.query(`select public.decide_review('${placed.orderId}', 'approved')`)));
await as("authenticated", admin, async () => {
  await db.query(`select public.decide_review('${placed.orderId}', 'approved')`);
  ok("admin approves the review and the artist average moves", Number((await one(`select rating_avg a from public.profiles where id='${artist}'`)).a) === 5);
  await db.query(`select public.decide_damage('${placed.orderId}', 'rejected', 'looks fine')`);
});

// a late payment on a refunded order must not refund again
const lateOrder = await svc(async () => (await one(place(buyer, artist, JSON.stringify([{listingId: lo, quantity: 1}])))).r);
await svc(() => db.query(`select public.expire_hold('${lateOrder.orderId}', true)`));
await db.exec(`update public.listings set stock = 0, status = 'sold' where id = '${lo}'`);
const over = await svc(async () => (await one(`select public.mark_paid('${lateOrder.orderId}', 'pay_late', 0) r`)).r);
ok("a late payment for sold stock is reported oversold", over.oversold === true);
await svc(() => db.query(`select public.refund_oversold('${lateOrder.orderId}', 'pay_late', 'rfnd_1')`));
const again = await svc(async () => (await one(`select public.mark_paid('${lateOrder.orderId}', 'pay_late', 0) r`)).r);
ok("mark_paid on a refunded order returns refunded (no second refund)", again.stage === "refunded" && !again.oversold);

// refunds and payouts on the paid order
await db.exec(`update public.artist_private set verified_at = now(), amount_owed = 0 where profile_id = '${artist}'`);
await svc(() => failsWith("a refund cannot exceed what was paid", "exceeds_paid", () => db.query(`select public.reserve_refund('${placed.orderId}', '[{"lineId":"${lp}","quantity":3}]', 'x')`)));
await db.exec(`update public.orders set payable = true where id = '${placed.orderId}'`);
const built = await svc(async () => (await one(`select public._build_payout_run() r`)).r);
ok("a payout draft is built for the verified artist", built.created.length === 1);
const draft = await one(`select id from public.payouts where artist_id='${artist}'`);
const rf = await svc(async () => (await one(`select public.reserve_refund('${placed.orderId}', '[{"lineId":"${lp}","quantity":1}]', 'damaged') r`)).r);
ok("a refund reserve returns the amount and payment", Number(rf.amount) === 100000 && rf.paymentId === "pay_1");
await svc(() => db.query(`select public.mark_refund_unknown('${rf.refundId}')`));
ok("a failed provider call keeps the refund as unknown", (await one(`select status from public.refunds where id='${rf.refundId}'`)).status === "unknown");
await svc(() => failsWith("a retry that would refund the same unit twice is refused", "exceeds_paid", () => db.query(`select public.reserve_refund('${placed.orderId}', '[{"lineId":"${lp}","quantity":2}]', 'again')`)));
await as("authenticated", admin, () => failsWith("a stale payout draft is refused", "rebuild", () => db.query(`select public.record_payout('${draft.id}', 'UTR1')`)));
await svc(() => db.query(`select public._build_payout_run()`));
const fresh = await one(`select id from public.payouts where artist_id='${artist}'`);
await as("authenticated", admin, async () => {
  await db.query(`select public.record_payout('${fresh.id}', 'UTR1')`);
  ok("a rebuilt draft is recorded and marks the orders paid out", (await one(`select payout_id from public.orders where id='${placed.orderId}'`)).payout_id === fresh.id);
});
await as("authenticated", B, () => failsWith("a buyer cannot record a payout", "forbidden", () => db.query(`select public.record_payout('${fresh.id}', 'x')`)));

// the sweep expires old holds
const stale = await svc(async () => (await one(place(other, artist, lines(1)))).r);
await db.exec(`update public.orders set hold_until = now() - interval '1 minute' where id = '${stale.orderId}'`);
const swept = await svc(async () => (await one(`select public.sweep() r`)).r);
ok("sweep expires a stale hold and frees the stock", swept.expireHolds === 1 && (await one(`select held from public.listings where id='${lp}'`)).held === 0);

// Reels (Instagram phase 1)
let reelA;
await as("authenticated", A, async () => {
  reelA = (await db.query(`insert into public.reels (artist_id, url, owner_confirmed) values ('${artist}', 'https://www.instagram.com/reel/ABC123/', true) returning id`)).rows[0].id;
  ok("artist adds a reel link", !!reelA);
});
await as("authenticated", A, () => rejects("a non-Instagram link is refused", () =>
  db.query(`insert into public.reels (artist_id, url, owner_confirmed) values ('${artist}', 'https://evil.example/reel/ABC', true)`)));
await as("authenticated", A, () => rejects("a reel needs the ownership tick", () =>
  db.query(`insert into public.reels (artist_id, url, owner_confirmed) values ('${artist}', 'https://instagram.com/reel/XYZ', false)`)));
await as("authenticated", O, () => rejects("another user cannot add a reel for an artist", () =>
  db.query(`insert into public.reels (artist_id, url, owner_confirmed) values ('${artist}', 'https://instagram.com/reel/XYZ2', true)`)));
const reelO = (await as("authenticated", {sub: other, app_metadata: {artist: true}}, async () => (await db.query(`insert into public.reels (artist_id, url, owner_confirmed) values ('${other}', 'https://instagram.com/reel/OTHER1', true) returning id`)).rows[0].id));
await as("authenticated", A, () => rejects("a product cannot use another artist's reel", () =>
  db.query(`update public.artworks set reel_id = '${reelO}' where id = '${artId}'`)));
await as("authenticated", A, async () => {
  await db.query(`update public.artworks set reel_id = '${reelA}' where id = '${artId}'`);
  ok("artist links their own reel to a product", (await one(`select reel_id from public.artworks where id='${artId}'`)).reel_id === reelA);
});
await as("authenticated", A, async () => {
  for (let i = 0; i < 11; i++) await db.query(`insert into public.reels (artist_id, url, owner_confirmed) values ('${artist}', 'https://instagram.com/reel/L${i}', true)`);
});
await as("authenticated", A, () => rejects("a 13th reel is refused", () =>
  db.query(`insert into public.reels (artist_id, url, owner_confirmed) values ('${artist}', 'https://instagram.com/reel/L99', true)`)));
await as("authenticated", A, async () => {
  await db.query(`update public.reels set highlighted = true where artist_id = '${artist}' and id in (select id from public.reels where artist_id = '${artist}' order by created_at limit 6)`);
});
await as("authenticated", A, () => rejects("a 7th highlighted reel is refused", () =>
  db.query(`update public.reels set highlighted = true where artist_id = '${artist}' and not highlighted`)));

// Instagram phase 2: private tables, verified locks, deletion status
await as("authenticated", A, () => rejects("a client cannot read instagram_accounts", () => db.query(`select * from public.instagram_accounts`)));
await as("authenticated", A, () => rejects("a client cannot write instagram_states", () =>
  db.query(`insert into public.instagram_states (state, artist_id, expires_at) values ('s', '${artist}', now())`)));
await as("anon", {}, () => rejects("anon cannot read instagram_deletions", () => db.query(`select * from public.instagram_deletions`)));
await as("authenticated", A, () => rejects("a client cannot mark a reel verified", () =>
  db.query(`update public.reels set verified = true where id = '${reelA}'`)));
await as("authenticated", A, () => rejects("a client cannot mark a profile verified", () =>
  db.query(`update public.profiles set instagram_verified = true where id = '${artist}'`)));
await db.exec(`update public.profiles set instagram_verified = true, instagram_handle = 'meera' where id = '${artist}'`);
await db.exec(`update public.reels set verified = true, ig_media_id = 'm1' where id = '${reelA}'`);
await as("authenticated", A, () => rejects("a verified handle cannot be changed by the artist", () =>
  db.query(`update public.profiles set instagram_handle = 'someone_else' where id = '${artist}'`)));
await as("authenticated", A, async () => {
  await db.query(`update public.profiles set bio = 'hello', instagram_handle = 'meera' where id = '${artist}'`);
  ok("saving the profile with the same verified handle still works", (await one(`select bio from public.profiles where id='${artist}'`)).bio === 'hello');
});
await as("authenticated", A, () => rejects("a verified reel link cannot be changed by the artist", () =>
  db.query(`update public.reels set url = 'https://instagram.com/reel/NEW' where id = '${reelA}'`)));
await as("authenticated", A, async () => {
  await db.query(`update public.reels set position = 7 where id = '${reelA}'`);
  ok("a verified reel can still be reordered", (await one(`select position from public.reels where id='${reelA}'`)).position === 7);
});
await db.exec(`update public.profiles set instagram_handle = 'meera_new' where id = '${artist}'`);
ok("the server can still change a verified handle", (await one(`select instagram_handle h from public.profiles where id='${artist}'`)).h === 'meera_new');
await rejects("one Instagram media cannot be imported twice", () =>
  db.query(`insert into public.reels (artist_id, url, owner_confirmed, ig_media_id) values ('${other}', 'https://instagram.com/reel/DUP', true, 'm1')`));
await db.exec(`insert into public.instagram_accounts (artist_id, ig_user_id, username, token_cipher, app_user_id, client_business_id) values ('${artist}', '1784', 'meera', 'x', '77', '55')`);
ok("an account with a never-expiring token (no expiry) can be stored", (await one(`select token_expires_at t from public.instagram_accounts where artist_id='${artist}'`)).t === null);
await db.exec(`insert into public.instagram_deletions (code, ig_user_id, done_at) values ('done1', '9', now()), ('open1', '9', null)`);
await as("anon", {}, async () => {
  ok("the deletion page can read a finished request", (await one(`select public.instagram_deletion_status('done1') d`)).d !== null);
  ok("an unfinished or unknown request shows nothing", (await one(`select public.instagram_deletion_status('open1') d`)).d === null
    && (await one(`select public.instagram_deletion_status('nope') d`)).d === null);
});

// An artist puts a new work on sale themselves: draft artwork, draft listing, then both published (what publishWork does)
let saleArt, saleList;
await as("authenticated", A, async () => {
  saleArt = (await db.query(`insert into public.artworks (artist_id, title, description, category, photos, status) values ('${artist}', 'Cute Keychain', 'd', 'Keychains', '{}', 'draft') returning id`)).rows[0].id;
  saleList = (await db.query(`insert into public.listings (artwork_id, artist_id, title, kind, size, medium, price, stock, status) values ('${saleArt}', '${artist}', 'Cute Keychain', 'product', '', '', 19900, 5, 'draft') returning id`)).rows[0].id;
  await db.query(`update public.artworks set status = 'published' where id = '${saleArt}'`);
  await db.query(`update public.listings set status = 'live' where id = '${saleList}'`);
});
const onSale = await one(`select a.status as art, l.status as lst, a.from_price_paise as from_price, a.available from public.artworks a join public.listings l on l.artwork_id = a.id where a.id = '${saleArt}'`);
ok("an artist can publish their own new work with a price", onSale.art === 'published' && onSale.lst === 'live' && Number(onSale.from_price) === 19900 && onSale.available === true);
await as("authenticated", A, () => rejects("an artist cannot list an original with stock above 1", () =>
  db.query(`insert into public.listings (artwork_id, artist_id, title, kind, price, stock, status) values ('${saleArt}', '${artist}', 'x', 'original', 50000, 3, 'draft')`)));

// My works: take down, put back, change price (what setWorkOnSale / setListingPrice do)
await as("authenticated", A, async () => {
  await db.query(`update public.listings set status = 'draft' where artwork_id = '${saleArt}' and status = 'live'`);
  await db.query(`update public.artworks set status = 'draft' where id = '${saleArt}'`);
});
const down = await one(`select a.available, l.status from public.artworks a join public.listings l on l.artwork_id = a.id where a.id = '${saleArt}'`);
ok("an artist can take a work down (not buyable)", down.status === 'draft' && down.available === false);
await as("authenticated", A, async () => {
  await db.query(`update public.artworks set status = 'published' where id = '${saleArt}'`);
  await db.query(`update public.listings set status = 'live' where artwork_id = '${saleArt}' and status = 'draft'`);
  await db.query(`update public.listings set price = 24900 where id = '${saleList}'`);
});
const back = await one(`select a.available, a.from_price_paise as p from public.artworks a where a.id = '${saleArt}'`);
ok("an artist can put it back and change its price", back.available === true && Number(back.p) === 24900);
await as("authenticated", O, () => rejects("someone else cannot change that price", async () => {
  const r = await db.query(`update public.listings set price = 100 where id = '${saleList}' returning id`);
  if (!r.rows.length) throw new Error("no rows: refused by row security");
}));

// The public Artist page, seen signed out
await as("anon", {}, async () => {
  const p = await one(`select display_name, restricted, rating_count from public.profiles where id = '${artist}'`);
  ok("a signed-out visitor can read an Artist's public profile", p.restricted === false && Number(p.rating_count) >= 1);
  await rejects("a signed-out visitor cannot read private artist details", () => db.query(`select pan from public.artist_private`));
});
await db.exec(`select public._set_standing('${artist}', true, 'test')`);
await as("anon", {}, async () => {
  ok("a restricted Artist's page still shows who they are", (await one(`select restricted r from public.profiles where id = '${artist}'`)).r === true);
  ok("a restricted Artist's works are hidden", (await one(`select count(*)::int n from public.artworks where artist_id = '${artist}'`)).n === 0);
  ok("a restricted Artist's reels are hidden", (await one(`select count(*)::int n from public.reels where artist_id = '${artist}'`)).n === 0);
});
await db.exec(`select public._set_standing('${artist}', false, '')`);
await as("anon", {}, async () => ok("lifting the restriction brings the works back", (await one(`select count(*)::int n from public.artworks where artist_id = '${artist}'`)).n >= 1));
await as("anon", {}, async () => ok("a bad id is a database error the page treats as not found", await db.query(`select id from public.profiles where id = 'abc'`).then(() => false, (e) => e.code === '22P02')));

// Mark all as read: only your own notifications change
await db.exec(`insert into public.notifications (user_id, type, data) values ('${buyer}', 'order_shipped', '{}'), ('${buyer}', 'order_paid', '{}'), ('${other}', 'order_paid', '{}')`);
await as("authenticated", B, async () => {
  await db.query(`update public.notifications set read = true where user_id = '${buyer}' and read = false`);
  ok("mark all as read clears my own notifications", (await one(`select count(*)::int n from public.notifications where user_id = '${buyer}' and read = false`)).n === 0);
});
ok("mark all as read leaves other people's notifications alone", (await one(`select count(*)::int n from public.notifications where user_id = '${other}' and read = false`)).n === 1);

// Reel names (0014)
await as("authenticated", A, async () => {
  await db.query(`update public.reels set title = 'Making of the blue vase' where id = '${reelA}'`);
  ok("an artist can name their reel", (await one(`select title from public.reels where id='${reelA}'`)).title === 'Making of the blue vase');
});
await as("authenticated", A, () => rejects("a reel name over 80 characters is refused", () =>
  db.query(`update public.reels set title = '${"x".repeat(81)}' where id = '${reelA}'`)));

// The api function runs as service_role: it must reach the tables the Instagram code uses
await as("service_role", {}, async () => {
  await db.query(`insert into public.instagram_states (state, artist_id, expires_at) values ('svc', '${artist}', now() + interval '10 minutes')`);
  const gone = await db.query(`delete from public.instagram_states where state = 'svc' returning artist_id`);
  ok("the server role can use instagram_states", gone.rows.length === 1);
  await db.query(`update public.reels set verified = true where id = '${reelA}'`);
  await db.query(`select * from public.instagram_accounts`);
  ok("the server role can reach reels and instagram_accounts", true);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
