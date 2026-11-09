import {PGlite} from "@electric-sql/pglite";
import fs from "node:fs";

const db = new PGlite();
const sql = fs.readFileSync(new URL("./migrations/0001_init.sql", import.meta.url), "utf8");

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
await db.exec(sql);
console.log("migration applied");

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
  artId = (await db.query(`insert into public.artworks (artist_id, title, category, status) values ('${artist}', 'Warli', 'Painting', 'draft') returning id`)).rows[0].id;
  ok("artist creates a draft artwork", !!artId);
});
await as("authenticated", A, () => rejects("artist cannot insert a published artwork", () =>
  db.query(`insert into public.artworks (artist_id, title, category, status) values ('${artist}', 'X', 'Painting', 'published')`)));
await as("authenticated", A, () => rejects("artist cannot insert as another artist", () =>
  db.query(`insert into public.artworks (artist_id, title, category, status) values ('${buyer}', 'X', 'Painting', 'draft')`)));
await as("authenticated", B, () => rejects("non-artist cannot insert an artwork", () =>
  db.query(`insert into public.artworks (artist_id, title, category, status) values ('${buyer}', 'X', 'Painting', 'draft')`)));
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
const theirArt = (await db.query(`insert into public.artworks (artist_id, title, category, status) values ('${buyer}', 'Not yours', 'Painting', 'published') returning id`)).rows[0].id;
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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
