-- From the Supabase security advisor after 0001.
-- The signup trigger must not be callable as /rest/v1/rpc/handle_new_user (the trigger itself still runs).
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Role helpers get a fixed search_path so a user-made object cannot shadow what they call.
alter function public.is_admin() set search_path = '';
alter function public.is_artist() set search_path = '';
