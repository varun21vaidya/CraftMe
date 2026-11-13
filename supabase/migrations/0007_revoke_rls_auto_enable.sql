-- Supabase's helper event trigger needs no public execute grant; the advisor flagged it as callable by anon.
-- The helper exists only on hosted projects, so a fresh local stack (supabase start) skips this.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
