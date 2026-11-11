-- The api function runs as service_role. Tables created after 0001's "grant all on all tables" need their own grant,
-- or the function gets "permission denied" (found when Connect Instagram failed). RLS stays on; service_role bypasses it.
grant all on public.reels, public.instagram_accounts, public.instagram_states, public.instagram_deletions to service_role;
