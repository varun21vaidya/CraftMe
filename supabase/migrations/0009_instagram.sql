-- Phase 2 of Instagram: an artist can connect their account and import their own reels (verified).
-- The three new tables are private: RLS on, no policies, no grants. Only the Edge Function (service role) reads them.

create table public.instagram_accounts (
  artist_id uuid primary key references public.profiles(id) on delete cascade,
  ig_user_id text not null unique,
  username text not null,
  token_cipher text not null,                 -- AES-GCM (iv + data), base64; the key lives in a Supabase secret
  token_expires_at timestamptz not null,
  refreshed_at timestamptz not null default now(),
  needs_reconnect boolean not null default false,
  connected_at timestamptz not null default now()
);

create table public.instagram_states (         -- one-time OAuth states: stop forged callbacks
  state text primary key,
  artist_id uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null
);

create table public.instagram_deletions (      -- Meta data-deletion requests; the status page reads by code
  code text primary key,
  ig_user_id text not null,
  created_at timestamptz not null default now(),
  done_at timestamptz
);

alter table public.instagram_accounts enable row level security;
alter table public.instagram_states enable row level security;
alter table public.instagram_deletions enable row level security;
revoke all on public.instagram_accounts, public.instagram_states, public.instagram_deletions from public, anon, authenticated;

alter table public.reels add column ig_media_id text unique, add column verified boolean not null default false;
alter table public.profiles add column instagram_verified boolean not null default false,
                            add column instagram_needs_reconnect boolean not null default false;
-- no client grant covers these columns, so only the service role can set them

-- A verified handle or reel link can't be changed by a client (the service role can).
create or replace function public.profiles_handle_guard() returns trigger language plpgsql set search_path = '' as $$
begin
  if old.instagram_verified and new.instagram_handle is distinct from old.instagram_handle
     and current_user in ('anon', 'authenticated') then
    raise exception '%', '{"code":"invalid","reason":"handle_verified"}';
  end if;
  return new;
end $$;
create trigger profiles_handle_guard before update of instagram_handle on public.profiles for each row execute function public.profiles_handle_guard();

create or replace function public.reels_verified_guard() returns trigger language plpgsql set search_path = '' as $$
begin
  if old.verified and new.url is distinct from old.url and current_user in ('anon', 'authenticated') then
    raise exception '%', '{"code":"invalid","reason":"reel_verified"}';
  end if;
  return new;
end $$;
create trigger reels_verified_guard before update of url on public.reels for each row execute function public.reels_verified_guard();

-- The public deletion-status page: returns when a request finished, or null. Reveals nothing else.
create or replace function public.instagram_deletion_status(p_code text) returns timestamptz
language sql stable security definer set search_path = '' as $$
  select done_at from public.instagram_deletions where code = p_code
$$;
revoke execute on function public.instagram_deletion_status(text) from public;
grant execute on function public.instagram_deletion_status(text) to anon, authenticated;
