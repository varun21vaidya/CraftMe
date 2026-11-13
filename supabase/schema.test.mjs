import {PGlite} from "@electric-sql/pglite";
import fs from "node:fs";
import {RULES} from "../src/lib/rules.js";

const db = new PGlite();
const migrations = ["0001_init", "0002_hardening", "0003_logic", "0004_storage", "0006_catalogue", "0008_reels", "0009_instagram", "0011_instagram_unified", "0013_service_role_grants", "0014_reel_title", "0015_wishlist", "0016_catalogue_search", "0017_saved_cart", "0018_collection_previews", "0019_checkout", "0020_damage_review", "0021_storefront"].map((n) => fs.readFileSync(new URL(`./migrations/${n}.sql`, import.meta.url), "utf8"));

// Minimal stand-ins for what Supabase provides.
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), raw_user_meta_data jsonb default '{}');
  create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on all functions in schema auth to anon, authenticated, service_role;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid, metadata jsonb default '{}', created_at timestamptz default now());
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:greatest(cardinality(string_to_array(name, '/')) - 1, 0)] $$;
  grant usage on schema storage to anon, authenticated, service_role;
  grant select, insert, update, delete on storage.objects to authenticated, service_role;
  grant select on storage.buckets to authenticated, service_role;
  grant execute on all functions in schema storage to anon, authenticated, service_role;
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
const secs = async (a, b) => Number((await one(`select extract(epoch from (${a} - ${b}))::int s from public.orders where id='${placed.orderId}'`)).s);
ok("the UI rules match the SQL: a fresh hold lasts holdMinutes", await secs("hold_until", "created_at") === RULES.holdMinutes * 60);
await svc(() => failsWith("cannot hold more than the free stock", "sold", () => db.query(place(other, artist, lines(2)))));
await svc(() => failsWith("a changed price is reported", "price_changed", () => db.query(place(other, artist, lines(1, 90000)))));
ok("a refused order leaves no hold behind", (await one(`select held from public.listings where id='${lp}'`)).held === 2);
await svc(() => failsWith("cannot buy your own work", "own_listing", () => db.query(place(artist, artist, lines(1)))));

const paid1 = await svc(async () => (await one(`select public.mark_paid('${placed.orderId}', 'pay_1', 2360) r`)).r);
ok("mark_paid moves the stock from held to sold", paid1.stage === "paid" && (await one(`select stock, held from public.listings where id='${lp}'`)).stock === 1);
const paid2 = await svc(async () => (await one(`select public.mark_paid('${placed.orderId}', 'pay_1', 2360) r`)).r);
ok("mark_paid twice changes nothing", paid2.stage === "paid" && (await one(`select stock from public.listings where id='${lp}'`)).stock === 1);
ok("the UI rules match the SQL: ship_by is shipDays after payment", await secs("ship_by", "paid_at") === RULES.shipDays * 86400);
ok("paying notified the buyer and the artist", (await one(`select count(*)::int n from public.notifications where type in ('order_paid','order_new')`)).n === 2);

await as("authenticated", O, () => failsWith("a stranger cannot ship", "forbidden", () => db.query(`select public.mark_shipped('${placed.orderId}', 'DTDC')`)));
await as("authenticated", A, () => failsWith("an artist must name a courier", "invalid", () => db.query(`select public.mark_shipped('${placed.orderId}', '  ')`)));
await as("authenticated", A, async () => { await db.query(`select public.mark_shipped('${placed.orderId}', 'DTDC', 'T1')`); ok("artist ships a paid order", true); });
ok("the UI rules match the SQL: auto_receive_at is autoReceiveDays after shipping", await secs("auto_receive_at", "shipped_at") === RULES.autoReceiveDays * 86400);
const photoRow = (uid, name, mime = "image/jpeg", hoursOld = 0) => db.exec(`insert into storage.objects (bucket_id, name, owner, metadata, created_at) values ('damage', '${uid}/${name}', '${uid}', '{"mimetype":"${mime}"}', now() - interval '${hoursOld} hours')`);
for (const n of ["a.jpg", "b.jpg", "c.jpg", "d.jpg", "e.jpg", "f.jpg", "g.jpg"]) await photoRow(buyer, n);
await photoRow(buyer, "x.webp", "image/webp");
for (const n of ["a.jpg", "b.jpg"]) { await photoRow(other, n); await photoRow(artist, n); }
const ph = (...names) => `damage/${buyer}/${names.join(`,damage/${buyer}/`)}`;
const rd = (order, lineIds, note, photos, kind = "torn") => `select public.report_damage('${order}', '{${lineIds}}', '${note}', '{${photos}}', '${kind}') r`;
const rdFails = (name, text, ...a) => as("authenticated", B, () => failsWith(name, text, () => db.query(rd(...a))));
await rdFails("cannot report damage before receiving", "wrong_stage", placed.orderId, lp, "broken", ph("a.jpg", "b.jpg"));
await as("authenticated", B, async () => { await db.query(`select public.confirm_received('${placed.orderId}')`); ok("buyer confirms receipt", true); });
ok("the UI rules match the SQL: damageDays and reviewDays after receipt", await secs("damage_window_ends", "received_at") === RULES.damageDays * 86400 && await secs("review_by", "received_at") === RULES.reviewDays * 86400);
await rdFails("one photo is refused", "photoPaths", placed.orderId, lp, "cracked", ph("a.jpg"));
await rdFails("seven photos are refused", "photoPaths", placed.orderId, lp, "cracked", ph("a.jpg", "b.jpg", "c.jpg", "d.jpg", "e.jpg", "f.jpg", "g.jpg"));
await rdFails("the same photo twice is refused", "photoPaths", placed.orderId, lp, "cracked", ph("a.jpg", "a.jpg"));
await rdFails("damage photos must be in the buyer's own folder", "photoPaths", placed.orderId, lp, "cracked", `damage/${other}/a.jpg,damage/${other}/b.jpg`);
await rdFails("a photo path with no stored object is refused", "photoPaths", placed.orderId, lp, "cracked", ph("a.jpg", "missing.jpg"));
await rdFails("a WebP object is refused", "photoPaths", placed.orderId, lp, "cracked", ph("a.jpg", "x.webp"));
await rdFails("801 characters are refused", "note", placed.orderId, lp, "x".repeat(801), ph("a.jpg", "b.jpg"));
await rdFails("an empty note is refused", "note", placed.orderId, lp, "   ", ph("a.jpg", "b.jpg"));
await rdFails("no line is refused", "lineIds", placed.orderId, "", "cracked", ph("a.jpg", "b.jpg"));
await rdFails("a duplicate line id is refused", "lineIds", placed.orderId, `${lp},${lp}`, "cracked", ph("a.jpg", "b.jpg"));
await rdFails("a line of another order is refused", "lineIds", placed.orderId, lo, "cracked", ph("a.jpg", "b.jpg"));
await rdFails("an unknown kind is refused", "kind", placed.orderId, lp, "cracked", ph("a.jpg", "b.jpg"), "scratched");
await as("authenticated", O, () => failsWith("another buyer cannot report on this order", "forbidden", () => db.query(rd(placed.orderId, lp, "cracked", `damage/${other}/a.jpg,damage/${other}/b.jpg`))));
await as("authenticated", A, () => failsWith("the artist cannot report damage", "forbidden", () => db.query(rd(placed.orderId, lp, "cracked", `damage/${artist}/a.jpg,damage/${artist}/b.jpg`))));
await db.exec(`update public.orders set damage_window_ends = now() - interval '1 minute' where id = '${placed.orderId}'`);
await rdFails("a report after the window is refused", "window_closed", placed.orderId, lp, "cracked", ph("a.jpg", "b.jpg"));
await db.exec(`update public.orders set damage_window_ends = now() + interval '1 day' where id = '${placed.orderId}'`);
await as("authenticated", B, async () => {
  const r = (await one(rd(placed.orderId, lp, " cracked  ", ph("a.jpg", "b.jpg"), "broken"))).r;
  ok("buyer reports damage in the window; the report has a code", /^[0-9A-F]{6}$/.test(r.code) && !!r.reportId);
});
{
  const rep = await one(`select kind, code, note, cardinality(photos) n, line_ids from public.damage_reports where order_id = '${placed.orderId}'`);
  ok("the report keeps kind, trimmed note, two photos and the line", rep.kind === "broken" && rep.note === "cracked" && rep.n === 2 && rep.line_ids[0] === lp);
}
await rdFails("a second damage report is refused", "already_exists", placed.orderId, lp, "again", ph("c.jpg", "d.jpg"));
ok("the damage bucket takes only JPEG and PNG", (await one("select allowed_mime_types a from storage.buckets where id = 'damage'")).a.join() === "image/jpeg,image/png");
const del = (claims, name) => as("authenticated", claims, async () => (await db.query(`delete from storage.objects where bucket_id = 'damage' and name = '${buyer}/${name}' returning name`)).rows.length);
ok("the buyer deletes an unreferenced own photo", await del(B, "e.jpg") === 1);
ok("a photo a report uses cannot be deleted", await del(B, "a.jpg") === 0);
ok("another user cannot delete the buyer's photo", await del(O, "c.jpg") === 0);
await photoRow(buyer, "old-orphan.jpg", "image/jpeg", 25);
await photoRow(buyer, "new-orphan.jpg", "image/jpeg", 1);
await db.exec(`update storage.objects set created_at = now() - interval '30 hours' where name in ('${buyer}/a.jpg', '${buyer}/b.jpg')`); // old but referenced
const orphans = await svc(async () => (await db.query("select * from public.damage_orphans()")).rows.map((r) => r.damage_orphans));
ok("damage_orphans lists only old unreferenced files", orphans.length === 1 && orphans[0] === `${buyer}/old-orphan.jpg`);
await as("authenticated", B, () => rejects("a buyer cannot call damage_orphans", () => db.query("select * from public.damage_orphans()")));
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

// Wish list and collections (0015)
const wid = (await one(`select id from public.artworks where status='published' and artist_open and artist_id = '${artist}' limit 1`)).id;
let col;
await as("authenticated", B, async () => {
  await db.query(`insert into public.saved_works (user_id, artwork_id) values ('${buyer}', '${wid}')`);
  ok("a buyer can save a published work", (await one(`select count(*)::int n from public.saved_works`)).n === 1);
  await rejects("saving the same work twice is refused", () => db.query(`insert into public.saved_works (user_id, artwork_id) values ('${buyer}', '${wid}')`));
  await rejects("cannot save for someone else", () => db.query(`insert into public.saved_works (user_id, artwork_id) values ('${other}', '${wid}')`));
  col = (await db.query(`insert into public.collections (user_id, name) values ('${buyer}', 'Gifts') returning id`)).rows[0].id;
  await rejects("a duplicate collection name in another case is refused", () => db.query(`insert into public.collections (user_id, name) values ('${buyer}', ' gifts ')`));
  await rejects("an empty collection name is refused", () => db.query(`insert into public.collections (user_id, name) values ('${buyer}', '  ')`));
  await rejects("a 61 character collection name is refused", () => db.query(`insert into public.collections (user_id, name) values ('${buyer}', '${"x".repeat(61)}')`));
  await db.query(`insert into public.collection_works (collection_id, user_id, artwork_id) values ('${col}', '${buyer}', '${wid}')`);
  ok("a saved work goes into a collection", (await one(`select count(*)::int n from public.collection_works`)).n === 1);
});
await as("authenticated", O, async () => {
  ok("another user sees none of it", (await one(`select (select count(*) from public.saved_works)::int + (select count(*) from public.collections)::int + (select count(*) from public.collection_works)::int n`)).n === 0);
  await rejects("cannot put a work in someone else's collection", () => db.query(`insert into public.collection_works (collection_id, user_id, artwork_id) values ('${col}', '${other}', '${wid}')`));
  await db.query(`delete from public.saved_works`);
});
await as("anon", {}, () => rejects("a signed-out visitor cannot read saved works", () => db.query(`select * from public.saved_works`)));
await as("authenticated", A, () => rejects("an artist cannot save their own work", () => db.query(`insert into public.saved_works (user_id, artwork_id) values ('${artist}', '${wid}')`)));
await as("authenticated", B, async () => {
  ok("another user's delete changed nothing", (await one(`select count(*)::int n from public.saved_works`)).n === 1);
  await db.query(`delete from public.saved_works where artwork_id = '${wid}'`);
  ok("un-saving removes the work from its collections", (await one(`select count(*)::int n from public.collection_works`)).n === 0);
  await db.query(`insert into public.saved_works (user_id, artwork_id) values ('${buyer}', '${wid}')`);
  await db.query(`delete from public.collections where id = '${col}'`);
  ok("deleting a collection keeps the saved work", (await one(`select count(*)::int n from public.saved_works`)).n === 1);
});
const hid = (await db.query(`insert into public.artworks (artist_id, title, category, status) values ('${artist}', 'Hidden', 'Paintings', 'draft') returning id`)).rows[0].id;
await as("authenticated", B, () => rejects("a hidden work cannot be saved", () => db.query(`insert into public.saved_works (user_id, artwork_id) values ('${buyer}', '${hid}')`)));
await db.exec(`insert into public.collections (user_id, name) select '${other}', 'c' || g from generate_series(1, 20) g`);
await as("authenticated", O, () => rejects("the 21st collection is refused", () => db.query(`insert into public.collections (user_id, name) values ('${other}', 'one too many')`)));

// The api function runs as service_role: it must reach the tables the Instagram code uses
await as("service_role", {}, async () => {
  await db.query(`insert into public.instagram_states (state, artist_id, expires_at) values ('svc', '${artist}', now() + interval '10 minutes')`);
  const gone = await db.query(`delete from public.instagram_states where state = 'svc' returning artist_id`);
  ok("the server role can use instagram_states", gone.rows.length === 1);
  await db.query(`update public.reels set verified = true where id = '${reelA}'`);
  await db.query(`select * from public.instagram_accounts`);
  ok("the server role can reach reels and instagram_accounts", true);
});

const searchArt = await one(`insert into public.artworks (artist_id, title, category, status)
  values ('${other}', 'Clay 100% bowl', 'Pottery & Ceramics', 'published') returning id`);
const otherListing = await one(`insert into public.listings (artist_id, artwork_id, title, kind, price, stock, status)
  values ('${other}', '${searchArt.id}', 'Clay bowl', 'product', 1000, 20, 'live') returning id`);
const activeListing = await one(`insert into public.listings (artist_id, artwork_id, title, kind, price, stock, status)
  values ('${artist}', '${wid}', 'Print', 'print', 1000, 20, 'live') returning id`);
await as("anon", {}, async () => {
  const { rows } = await db.query("select public.search_catalogue($1, false, null, 0) as item", ["100%"]);
  ok("public catalogue search treats percent as literal text", rows.length === 1 && rows[0].item.id === searchArt.id);
  const hidden = await db.query("select public.search_catalogue('Hidden', false, null, 0)");
  ok("catalogue search excludes drafts", hidden.rows.length === 0);
});
await as("authenticated", B, async () => {
  const op = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
  const active = JSON.stringify([{ listingId: activeListing.id, qty: 3 }]);
  const args = [buyer, op, active, [], otherListing.id];
  const callSwitch = "select public.switch_saved_cart($1, $2, $3, $4, $5) as result";
  const first = (await db.query(callSwitch, args)).rows[0].result;
  await db.query(callSwitch, args);
  const saved = await one("select qty from public.saved_cart_items");
  ok("cart switch saves outgoing quantities once and returns the new cart", first.artistId === other && saved.qty === 3);
  const restored = (await db.query(callSwitch, [buyer, 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
    JSON.stringify(first.items), [activeListing.id], null])).rows[0].result;
  ok("restoring the saved cart swaps artist and preserves quantity", restored.artistId === artist && restored.items[0].qty === 3);
});
await as("authenticated", O, async () => {
  ok("saved carts are private to the buyer", (await one("select count(*)::int n from public.saved_cart_items")).n === 0);
});


// ---------- checkout (0019) ----------
{
  const art = (await one(`insert into public.artworks (artist_id, title, category, status) values ('${artist}', 'Checkout', 'Paintings', 'published') returning id`)).id;
  const mk = async (kind, price, stock, status = 'live') => (await one(`insert into public.listings (artwork_id, artist_id, title, kind, price, stock, status) values ('${art}','${artist}','${kind}','${kind}',${price},${stock},'${status}') returning id`)).id;
  const pa = await mk('print', 50000, 20), pb = await mk('print', 60000, 20), sold = await mk('original', 90000, 0, 'sold');
  const heldOut = await mk('original', 70000, 1), ended = await mk('print', 40000, 5, 'ended');
  await db.exec(`update public.listings set held = 1 where id = '${heldOut}'`);
  const full = JSON.stringify({name: "B", phone: "9876543210", address: "1 Road", address2: "Flat 4", landmark: "Near the park", city: "Pune", state: "Maharashtra", pin: "411001", note: "  Happy birthday  ", save: true});
  const r = await svc(async () => (await one(`select public.place_order('${buyer}','${artist}','${JSON.stringify([{listingId: pa, quantity: 1}])}','${full}') r`)).r);
  ok("place_order returns the code and the server clock", typeof r.code === "string" && r.code.length === 6 && !!r.serverNow);
  const ship = await one(`select address2, landmark from public.order_shipping where order_id = '${r.orderId}'`);
  ok("address2 and landmark are stored", ship.address2 === "Flat 4" && ship.landmark === "Near the park");
  ok("the gift note is trimmed and stored", (await one(`select gift_note from public.orders where id = '${r.orderId}'`)).gift_note === "Happy birthday");
  ok("save writes the saved address", (await one(`select city from public.saved_addresses where user_id = '${buyer}'`))?.city === "Pune");
  const noSave = JSON.stringify({name: "B", phone: "9876543210", address: "2 Road", city: "Mumbai", state: "Maharashtra", pin: "400050"});
  const r2 = await svc(async () => (await one(`select public.place_order('${buyer}','${artist}','${JSON.stringify([{listingId: pb, quantity: 1}])}','${noSave}') r`)).r);
  ok("the old four-key address still places an order", !!r2.orderId);
  ok("an order without save leaves the saved address alone", (await one(`select city from public.saved_addresses where user_id = '${buyer}'`)).city === "Pune");
  await as("authenticated", B, async () => ok("the owner reads their saved address", (await one("select count(*)::int n from public.saved_addresses")).n === 1));
  await as("authenticated", O, async () => ok("another user cannot read it", (await one("select count(*)::int n from public.saved_addresses")).n === 0));
  await as("authenticated", O, () => rejects("another user cannot write an address for someone else", () =>
    db.query(`insert into public.saved_addresses (user_id, name, phone, address, city, state, pin) values ('${buyer}','x','9876543210','a','c','s','411001')`)));
  await as("authenticated", B, () => rejects("a bad PIN is refused", () =>
    db.query(`update public.saved_addresses set pin = '4110' where user_id = '${buyer}'`)));
  await as("anon", {}, () => rejects("anon cannot read saved addresses", () => db.query("select * from public.saved_addresses")));
  await svc(() => db.query(`select public.expire_hold('${r.orderId}', true), public.expire_hold('${r2.orderId}', true)`));

  // my_order_counts: only the caller's purchases
  const counts = await as("authenticated", B, async () => (await one("select public.my_order_counts() c")).c);
  const expected = await one(`select count(*) filter (where stage='paid')::int paid, count(*) filter (where stage not in ('hold','hold_expired'))::int "all" from public.orders where buyer_id='${buyer}'`);
  ok("my_order_counts counts the caller's orders by stage", counts.paid === expected.paid && counts.all === expected.all);
  const artistCounts = await as("authenticated", A, async () => (await one("select public.my_order_counts() c")).c);
  ok("an Artist's sales are not counted as their purchases", artistCounts.all === 0);
  await as("anon", {}, () => rejects("anon cannot call my_order_counts", () => db.query("select public.my_order_counts()")));

  // switch_saved_cart_many (D07)
  const otherArt = (await one(`insert into public.artworks (artist_id, title, category, status) values ('${other}', 'Elsewhere', 'Paintings', 'published') returning id`)).id;
  const ol = (await one(`insert into public.listings (artwork_id, artist_id, title, kind, price, stock, status) values ('${otherArt}','${other}','Print','print',30000,5,'live') returning id`)).id;
  await db.exec(`delete from public.saved_cart_items where buyer_id = '${buyer}'`);
  const op = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const switchMany = `select public.switch_saved_cart_many($1, $2, $3, $4) r`;
  const args = [buyer, op, JSON.stringify([{listingId: ol, qty: 2}]), [pa, pb, sold, heldOut, ended]];
  const many = await as("authenticated", B, async () => (await db.query(switchMany, args)).rows[0].r);
  ok("the group switch adds the eligible listings at quantity 1", many.artistId === artist && many.items.length === 2 && many.items.every((i) => i.qty === 1));
  const reasons = Object.fromEntries(many.skipped.map((x) => [x.listingId, x.reason]));
  ok("the group switch reports sold, held and gone listings", reasons[sold] === "sold" && reasons[heldOut] === "held" && reasons[ended] === "gone");
  ok("the outgoing Cart is saved for later", (await one(`select qty from public.saved_cart_items where buyer_id='${buyer}' and listing_id='${ol}'`)).qty === 2);
  const replay = await as("authenticated", B, async () => (await db.query(switchMany, args)).rows[0].r);
  ok("a replayed operation returns the first result and saves nothing twice", JSON.stringify(replay) === JSON.stringify(many)
    && (await one(`select qty from public.saved_cart_items where buyer_id='${buyer}' and listing_id='${ol}'`)).qty === 2
    && (await one(`select count(*)::int n from public.saved_cart_operations where buyer_id='${buyer}' and operation_id='${op}'`)).n === 1);
  const same = await as("authenticated", B, async () => (await db.query(switchMany, [buyer, "dddddddd-dddd-4ddd-8ddd-dddddddddddd", JSON.stringify([{listingId: pa, qty: 3}]), [pa, pb]])).rows[0].r);
  ok("a listing already in the Cart keeps its quantity", same.items.find((i) => i.listingId === pa).qty === 3 && same.items.length === 2);
  const none = await as("authenticated", B, async () => (await db.query(switchMany, [buyer, "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", JSON.stringify([{listingId: ol, qty: 1}]), [sold]])).rows[0].r);
  ok("nothing eligible leaves the Cart unchanged", none.unchanged === true && none.skipped[0].reason === "sold");
  await as("authenticated", B, () => rejects("listings from two Artists are refused", () => db.query(switchMany, [buyer, "ffffffff-ffff-4fff-8fff-ffffffffffff", "[]", [pa, ol]])));
  await as("authenticated", O, () => rejects("the group switch only runs for the caller", () => db.query(switchMany, [buyer, "abababab-abab-4bab-8bab-abababababab", "[]", [pa]])));
  await as("anon", {}, () => rejects("anon cannot call the group switch", () => db.query(switchMany, [buyer, "acacacac-acac-4cac-8cac-acacacacacac", "[]", [pa]])));

  // received automatically vs confirmed early: derived from received_at >= auto_receive_at
  const shipAndPay = async () => {
    const o = await svc(async () => (await one(`select public.place_order('${buyer}','${artist}','${JSON.stringify([{listingId: pa, quantity: 1}])}','${noSave}') r`)).r);
    await svc(() => db.query(`select public.mark_paid('${o.orderId}', 'pay_${o.orderId}', 0)`));
    await as("authenticated", A, () => db.query(`select public.mark_shipped('${o.orderId}', 'DTDC', 'T')`));
    return o.orderId;
  };
  const early = await shipAndPay();
  await as("authenticated", B, () => db.query(`select public.confirm_received('${early}')`));
  ok("a receipt confirmed early is not labelled automatic", (await one(`select received_at < auto_receive_at a from public.orders where id='${early}'`)).a === true);
  const late = await shipAndPay();
  await db.exec(`update public.orders set auto_receive_at = now() - interval '1 minute', shipped_at = now() - interval '15 days' where id = '${late}'`);
  await svc(() => db.query(`select public.sweep()`));
  ok("the sweep's receipt is labelled automatic", (await one(`select received_at >= auto_receive_at a from public.orders where id='${late}'`)).a === true);
  await as("authenticated", B, () => failsWith("a second confirmation fails with wrong_stage", "wrong_stage", () => db.query(`select public.confirm_received('${late}')`)));
}


// ---------- QA-S09-09: the address is private until payment ----------
{
  const art = (await one(`insert into public.artworks (artist_id, title, category, status) values ('${artist}', 'Private', 'Paintings', 'published') returning id`)).id;
  const li = (await one(`insert into public.listings (artwork_id, artist_id, title, kind, price, stock, status) values ('${art}','${artist}','Print','print',10000,5,'live') returning id`)).id;
  const addrJson = JSON.stringify({name: "B", phone: "9876543210", address: "1 Road", city: "Pune", state: "Maharashtra", pin: "411001"});
  const placeOne = async () => (await svc(async () => (await one(`select public.place_order('${buyer}','${artist}','${JSON.stringify([{listingId: li, quantity: 1}])}','${addrJson}') r`)).r)).orderId;
  const held = await placeOne();
  const shipCount = async (claims, id) => as("authenticated", claims, async () => (await one(`select count(*)::int n from public.order_shipping where order_id = '${id}'`)).n);
  ok("the Artist cannot read the address of a hold", await shipCount(A, held) === 0);
  await svc(() => db.query(`select public.expire_hold('${held}', true)`));
  const paidOrder = await placeOne();
  await svc(() => db.query(`select public.mark_paid('${paidOrder}', 'pay_private', 0)`));
  ok("the Artist reads the address once the Order is Paid", await shipCount(A, paidOrder) === 1);
  ok("another user cannot read it", await shipCount(O, paidOrder) === 0);
  ok("the buyer reads their own", await shipCount(B, paidOrder) === 1);
}

// ---------- P03 storefront ----------
{
  const mkUser = async (name) => (await one(`insert into auth.users (id, raw_user_meta_data) values (gen_random_uuid(), '${JSON.stringify({full_name: name})}') returning id`)).id;
  const sa = await mkUser("Sam Art"), sb = await mkUser("Meera Iyer"), sc = await mkUser("Meera Iyer"), sd = await mkUser("Restricted Rae"), buyer3 = await mkUser("Casual Buyer"), digits = await mkUser("12345");
  const S = (id) => ({sub: id, app_metadata: {}});
  await db.exec(`update public.profiles set roles = '{artist}' where id in ('${sa}', '${sb}', '${sc}', '${sd}', '${digits}')`);
  const slugOf = async (id) => (await one(`select slug from public.profiles where id = '${id}'`)).slug;
  ok("a slug is made when the Artist role is granted", await slugOf(sa) === "sam-art");
  ok("two Artists with one name get different slugs", await slugOf(sb) === "meera-iyer" && await slugOf(sc) === "meera-iyer-2");
  ok("a name with no letters still gets a slug", (await slugOf(digits)).length >= 3);
  ok("a Buyer has no slug", await slugOf(buyer3) === null);
  await db.exec(`update public.profiles set display_name = 'Renamed Meera' where id = '${sb}'`);
  ok("a display-name change does not change the slug", await slugOf(sb) === "meera-iyer");
  await as("authenticated", S(sb), () => rejects("a client cannot write slug directly", () => db.query(`update public.profiles set slug = 'mine-now' where id = '${sb}'`)));
  await as("authenticated", S(sb), () => failsWith("a taken slug is refused", "slug_taken", () => db.query(`select public.set_artist_slug('sam-art')`)));
  await as("authenticated", S(sb), () => failsWith("a bad slug shape is refused", "slug", () => db.query(`select public.set_artist_slug('Bad Slug!')`)));
  await as("authenticated", S(sb), () => failsWith("a uuid-shaped slug is refused", "slug", () => db.query(`select public.set_artist_slug('${sb.replace(/-/g, "")}')`)));
  await as("authenticated", S(buyer3), () => failsWith("a Buyer cannot set a slug", "forbidden", () => db.query(`select public.set_artist_slug('casual-buyer')`)));
  await as("authenticated", S(sb), async () => { await db.query(`select public.set_artist_slug(' New-Name ')`); });
  ok("set_artist_slug changes only the caller's slug", await slugOf(sb) === "new-name" && await slugOf(sc) === "meera-iyer-2");
  await as("authenticated", S(sc), async () => { await db.query(`select public.set_artist_slug('meera-iyer')`); });
  ok("the old slug is free for someone else", await slugOf(sc) === "meera-iyer");

  // works
  const art = async (artist, title, cat, status = "published", medium = "", createdAt = "now()") =>
    (await one(`insert into public.artworks (artist_id, title, category, status, medium, created_at) values ('${artist}', '${title}', '${cat}', '${status}', '${medium}', ${createdAt}) returning id`)).id;
  const lst = (aw, artist, kind, price, stock, status = "live", medium = "") =>
    db.exec(`insert into public.listings (artwork_id, artist_id, title, kind, price, stock, status, medium) values ('${aw}', '${artist}', '${kind}', '${kind}', ${price}, ${stock}, '${status}', '${medium}')`);
  const w8 = await art(sa, "Riso Sunrise", "Art Prints", "published", "two-colour riso");
  await lst(w8, sa, "print", 180000, 40); await lst(w8, sa, "product", 90000, 5);
  const w2 = await art(sa, "Kolam at Dawn", "Drawings");
  await lst(w2, sa, "original", 1800000, 0, "sold"); await lst(w2, sa, "print", 220000, 12);
  const w3 = await art(sa, "Temple Tank", "Paintings", "published", "Acrylic on canvas");
  await lst(w3, sa, "original", 3000000, 0, "sold");
  const w4 = await art(sa, "Coconut Draft", "Paintings", "draft"); await lst(w4, sa, "print", 100000, 5, "draft");
  const w5 = await art(sa, "Pongal Ended", "Art Prints"); await lst(w5, sa, "print", 150000, 5, "ended");
  const w7 = await art(sd, "Peacock Hidden", "Paintings"); await lst(w7, sd, "original", 2000000, 1);
  await db.exec(`update public.profiles set restricted = true where id = '${sd}'; update public.artworks set artist_open = false where artist_id = '${sd}'; update public.listings set artist_open = false where artist_id = '${sd}'`);
  const wm = await art(sb, "Kappa Print", "Paintings"); await lst(wm, sb, "print", 250000, 5, "live", "Oil on canvas");
  const browse = async (claims, p) => as(claims.sub ? "authenticated" : "anon", claims, async () => (await one(`select public.browse_catalogue('${JSON.stringify(p)}'::jsonb) r`)).r);
  const titles = (r) => r.items.map((i) => i.title).sort();
  const G = {};
  let r = await browse(G, {});
  ok("browse never shows a draft, an ended-only work or a restricted Artist's work", !titles(r).some((t) => ["Coconut Draft", "Pongal Ended", "Peacock Hidden"].includes(t)) && titles(r).includes("Temple Tank"));
  r = await browse(G, {categories: ["Art Prints"], kinds: ["print"], q: "riso", artist: sa});
  ok("browse: group, type, text and artist together find the one work", r.total === 1 && r.items[0].title === "Riso Sunrise");
  ok("browse: an item has the card data (artist name, kinds)", r.items[0].artist.display_name === "Sam Art" && r.items[0].kinds.includes("print"));
  r = await browse(G, {q: "ACRYLIC"}); ok("browse: q matches the artwork's medium, ignoring case", titles(r).join() === "Temple Tank");
  r = await browse(G, {q: "oil on"}); ok("browse: q matches a live listing's medium", titles(r).join() === "Kappa Print");
  r = await browse(G, {q: "100%"}); ok("browse: % in q is a plain character, not a wildcard", titles(r).join() === "Clay 100% bowl");
  r = await browse(G, {q: "c_ay"}); ok("browse: _ in q is a plain character too", r.total === 0);
  r = await browse(G, {q: "sam art"}); ok("browse: q matches the artist's name", r.total === 3);
  r = await browse(G, {minPaise: 260000, maxPaise: 200000, artist: sb});
  ok("browse: reversed price bounds are swapped", titles(r).join() === "Kappa Print");
  r = await browse(G, {minPaise: 200000, maxPaise: 260000, artist: sa}); ok("browse: price bounds compare the from price", titles(r).join() === "Kolam at Dawn");
  r = await browse(G, {hideSold: true, artist: sa}); ok("browse: hide sold keeps a sold Original with a live Print and drops an all-sold work", titles(r).includes("Kolam at Dawn") && !titles(r).includes("Temple Tank"));
  r = await browse(G, {onlySold: true, artist: sa}); ok("browse: onlySold lists the all-sold work", titles(r).join() === "Temple Tank");
  r = await browse(G, {kinds: ["original"], artist: sa}); ok("browse: type keeps only works with a live Listing of that kind", r.total === 0);

  // paging with ties: 30 works with one timestamp and 4 shared prices
  const ties = await art(sb, "Tie 00", "Art Prints"); await lst(ties, sb, "print", 99900, 3);
  for (let i = 1; i < 30; i++) { const t = await art(sb, `Tie ${String(i).padStart(2, "0")}`, "Art Prints"); await lst(t, sb, "print", i < 4 ? 99900 : 100000 + i, 3); }
  await db.exec(`update public.artworks set created_at = '2026-01-01T00:00:00Z' where title like 'Tie %'`);
  for (const sort of ["new", "price_asc", "price_desc", "rating"]) {
    const total = (await browse(G, {sort})).total; const seen = []; let full = true;
    for (let pg = 0; pg * 24 < total; pg++) { const part = await browse(G, {sort, page: pg}); if (pg < Math.ceil(total / 24) - 1 && part.items.length !== 24) full = false; seen.push(...part.items.map((i) => i.id)); }
    ok(`browse ${sort}: pages are 24 long and together give every work once`, full && seen.length === total && new Set(seen).size === total);
  }
  r = await browse(G, {sort: "price_asc"}); ok("browse: price ascending starts with the lowest", r.items[0].from_price_paise <= r.items[1].from_price_paise);
  r = await browse(G, {sort: "price_desc"}); ok("browse: price descending starts with the highest", r.items[0].from_price_paise >= r.items[1].from_price_paise);

  // reports
  const rf = (name, text, claims, sqlText) => as("authenticated", claims, () => failsWith(name, text, () => db.query(sqlText)));
  await rf("an unknown reason is refused", "reason", S(buyer3), `select public.report('artwork', '${w8}', 'spam', '')`);
  await rf("an artist reason is refused for an artwork", "reason", S(buyer3), `select public.report('artwork', '${w8}', 'impersonation', '')`);
  await rf("a missing target is refused", "not_found", S(buyer3), `select public.report('artwork', gen_random_uuid(), 'other', '')`);
  await rf("a draft cannot be reported", "not_found", S(buyer3), `select public.report('artwork', '${w4}', 'other', '')`);
  await rf("a report on one's own work is refused", "own_target", S(sa), `select public.report('artwork', '${w8}', 'other', '')`);
  await rf("a report on one's own profile is refused", "own_target", S(sa), `select public.report('artist', '${sa}', 'other', '')`);
  await rf("501 characters of details are refused", "details", S(buyer3), `select public.report('artwork', '${w8}', 'copied', '${"x".repeat(501)}')`);
  await as("authenticated", S(buyer3), () => db.query(`select public.report('artwork', '${w8}', 'copied', '${"x".repeat(500)}')`));
  ok("a report is stored open with its details", (await one(`select reason || '|' || length(details) || '|' || status as v from public.reports where target_id = '${w8}'`)).v === "copied|500|open");
  await rf("the same report twice is refused", "already_exists", S(buyer3), `select public.report('artwork', '${w8}', 'copied', '')`);
  await as("authenticated", S(buyer3), () => db.query(`select public.report('artist', '${sa}', 'impersonation', 'looks like a copy')`));
  ok("an artist report is stored", Number((await one(`select count(*) c from public.reports where target_type = 'artist'`)).c) === 1);
  await rf("a restricted Artist cannot be reported", "not_found", S(buyer3), `select public.report('artist', '${sd}', 'other', '')`);

  // reviews are readable without the buyer id
  await as("anon", {}, () => rejects("a signed-out visitor cannot read buyer_id", () => db.query("select buyer_id from public.reviews")));
  await as("anon", {}, async () => ok("a signed-out visitor reads the public review columns, approved rows only", (await db.query("select order_id, rating, comment, buyer_name, status, created_at from public.reviews")).rows.every((x) => x.status === "approved")));

  // stats, summary, verified
  const stats = (id) => as("anon", {}, async () => (await one(`select public.artist_public_stats('${id}') s`)).s);
  const sast = await stats(sa);
  ok("stats count the Artist's public works", sast.artworks === 3 && sast.ordersShipped === 0 && sast.avgShipHours === null);
  ok("stats are null for a restricted Artist and for a Buyer", (await stats(sd)) === null && (await stats(buyer3)) === null);
  const summary = await as("anon", {}, async () => (await one(`select public.artist_review_summary('${artist}') s`)).s);
  ok("the review summary has five buckets", ["1", "2", "3", "4", "5"].every((k) => typeof summary[k] === "number"));
  ok("verified starts false for a new Artist", (await one(`select verified v from public.profiles where id = '${sa}'`)).v === false);
  await db.exec(`insert into public.artist_private (profile_id, legal_name, pan) values ('${sa}', 'Sam', 'ABCDE1234F') on conflict do nothing`);
  await as("authenticated", {sub: other, app_metadata: {admin: true}}, () => db.query(`select public.mark_verified('${sa}')`));
  ok("mark_verified sets verified", (await one(`select verified v from public.profiles where id = '${sa}'`)).v === true);
  await as("authenticated", S(sa), () => db.query(`select public.submit_verification('Sam A', 'ABCDE1234F', '{"type":"upi","upi":"sam@upi"}')`));
  ok("a re-submitted verification clears verified", (await one(`select verified v from public.profiles where id = '${sa}'`)).v === false);

  // view counter
  await as("anon", {}, () => db.query(`select public.bump_view('${w8}')`));
  await as("anon", {}, () => db.query(`select public.bump_view('${w4}')`));
  ok("bump_view counts a public work and not a draft", (await one(`select views v from public.artworks where id = '${w8}'`)).v === 1 && (await one(`select views v from public.artworks where id = '${w4}'`)).v === 0);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
