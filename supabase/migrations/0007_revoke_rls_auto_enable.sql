-- Supabase's helper event trigger needs no public execute grant; the advisor flagged it as callable by anon.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
