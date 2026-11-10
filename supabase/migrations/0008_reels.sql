-- Phase 1 of Instagram: artists paste reel links, highlight some on their page, and link one reel to each product.
-- No Meta API yet, so ownership is an artist's confirmation (owner_confirmed) and can be reported.

create table public.reels (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.profiles(id) on delete cascade,
  url text not null check (url ~ '^https://(www\.)?instagram\.com/(reel|reels|p)/[A-Za-z0-9_-]+/?(\?.*)?$'),
  cover text,                                  -- optional picture the artist uploads (artworks bucket path)
  highlighted boolean not null default false,
  position integer not null default 0 check (position >= 0),
  owner_confirmed boolean not null check (owner_confirmed),
  created_at timestamptz not null default now()
);
create index reels_by_artist on public.reels (artist_id, position);

alter table public.artworks add column reel_id uuid references public.reels(id) on delete set null;

-- Limits and ownership, enforced in one place for every writer.
create or replace function public.reels_guard() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' and (select count(*) from public.reels where artist_id = new.artist_id) >= 12 then
    raise exception '%', '{"code":"invalid","reason":"reel_limit"}';
  end if;
  if new.highlighted and (tg_op = 'INSERT' or not old.highlighted)
     and (select count(*) from public.reels where artist_id = new.artist_id and highlighted) >= 6 then
    raise exception '%', '{"code":"invalid","reason":"highlight_limit"}';
  end if;
  return new;
end $$;
create trigger reels_guard before insert or update on public.reels for each row execute function public.reels_guard();

create or replace function public.artworks_reel_guard() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.reel_id is not null and not exists (
    select 1 from public.reels r where r.id = new.reel_id and r.artist_id = new.artist_id) then
    raise exception '%', '{"code":"invalid","reason":"reel_not_yours"}';
  end if;
  return new;
end $$;
create trigger artworks_reel_guard before insert or update of reel_id on public.artworks for each row execute function public.artworks_reel_guard();

-- Access: anyone sees reels of artists who are not restricted; only the owner writes.
alter table public.reels enable row level security;
create policy reels_read on public.reels for select using (
  artist_id = auth.uid() or public.is_admin()
  or exists (select 1 from public.profiles p where p.id = artist_id and not p.restricted));
create policy reels_insert on public.reels for insert to authenticated with check (
  public.is_artist() and artist_id = auth.uid()
  and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.restricted));
create policy reels_update on public.reels for update to authenticated
  using (artist_id = auth.uid()) with check (artist_id = auth.uid());
create policy reels_delete on public.reels for delete to authenticated using (artist_id = auth.uid());

grant select on public.reels to anon, authenticated;
grant insert (artist_id, url, cover, highlighted, position, owner_confirmed) on public.reels to authenticated;
grant update (url, cover, highlighted, position) on public.reels to authenticated;
grant delete on public.reels to authenticated;
grant insert (reel_id) on public.artworks to authenticated;
grant update (reel_id) on public.artworks to authenticated;
