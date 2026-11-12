-- Wish list and collections. Private to the owner: saved works, and named groups of saved works.
-- A work can only be in a collection if it is saved (composite foreign key), so un-saving leaves every collection.

create table public.saved_works (
  user_id uuid not null references public.profiles(id) on delete cascade,
  artwork_id uuid not null references public.artworks(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, artwork_id)
);
create index saved_works_recent on public.saved_works (user_id, created_at desc);

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  created_at timestamptz not null default now()
);
create unique index collections_name on public.collections (user_id, lower(btrim(name)));

create table public.collection_works (
  collection_id uuid not null references public.collections(id) on delete cascade,
  user_id uuid not null,
  artwork_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (collection_id, artwork_id),
  foreign key (user_id, artwork_id) references public.saved_works (user_id, artwork_id) on delete cascade
);

-- Limits, enforced for every writer (not only the page).
create or replace function public.wishlist_guard() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- nested on purpose: plpgsql resolves NEW's columns per table, so only the matching branch may read them
  if tg_table_name = 'saved_works' then
    if (select count(*) from public.saved_works where user_id = new.user_id) >= 500 then
      raise exception '%', '{"code":"invalid","reason":"wishlist_full"}';
    end if;
  elsif tg_table_name = 'collections' then
    if (select count(*) from public.collections where user_id = new.user_id) >= 20 then
      raise exception '%', '{"code":"invalid","reason":"collection_limit"}';
    end if;
  else
    if (select count(*) from public.collection_works where collection_id = new.collection_id) >= 100 then
      raise exception '%', '{"code":"invalid","reason":"collection_full"}';
    end if;
  end if;
  return new;
end $$;
create trigger wishlist_guard before insert on public.saved_works for each row execute function public.wishlist_guard();
create trigger wishlist_guard before insert on public.collections for each row execute function public.wishlist_guard();
create trigger wishlist_guard before insert on public.collection_works for each row execute function public.wishlist_guard();

alter table public.saved_works enable row level security;
alter table public.collections enable row level security;
alter table public.collection_works enable row level security;

create policy saved_read on public.saved_works for select to authenticated using (user_id = auth.uid());
create policy saved_insert on public.saved_works for insert to authenticated with check (
  user_id = auth.uid()
  and exists (select 1 from public.artworks a where a.id = artwork_id and a.status = 'published' and a.artist_open and a.artist_id <> auth.uid()));
create policy saved_delete on public.saved_works for delete to authenticated using (user_id = auth.uid());

create policy collections_read on public.collections for select to authenticated using (user_id = auth.uid());
create policy collections_insert on public.collections for insert to authenticated with check (user_id = auth.uid());
create policy collections_update on public.collections for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy collections_delete on public.collections for delete to authenticated using (user_id = auth.uid());

create policy cw_read on public.collection_works for select to authenticated using (user_id = auth.uid());
create policy cw_insert on public.collection_works for insert to authenticated with check (
  user_id = auth.uid() and exists (select 1 from public.collections c where c.id = collection_id and c.user_id = auth.uid()));
create policy cw_delete on public.collection_works for delete to authenticated using (user_id = auth.uid());

grant select, delete on public.saved_works, public.collection_works, public.collections to authenticated;
grant insert (user_id, artwork_id) on public.saved_works to authenticated;
grant insert (user_id, name) on public.collections to authenticated;
grant update (name) on public.collections to authenticated;
grant insert (collection_id, user_id, artwork_id) on public.collection_works to authenticated;
grant all on public.saved_works, public.collections, public.collection_works to service_role;
