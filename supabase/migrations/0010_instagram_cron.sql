-- Daily at 02:15 UTC: ask the api function to refresh Instagram tokens that expire within 14 days.
-- The shared secret is read from Supabase Vault (name: instagram_cron_secret) and must equal the INSTAGRAM_CRON_SECRET
-- function secret. Until both exist the call is refused (401) and nothing happens. Not run in the PGlite tests (needs pg_cron, pg_net).
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'craftme-instagram-refresh',
  '15 2 * * *',
  $job$
  select net.http_post(
    url := 'https://iftjiddrgigqmvsdiasw.supabase.co/functions/v1/api/instagram/refresh',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'instagram_cron_secret'), '')),
    body := '{}'::jsonb
  );
  $job$
);
