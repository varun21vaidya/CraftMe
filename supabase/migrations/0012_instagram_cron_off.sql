-- Tokens no longer expire, so the daily refresh job from 0010 is not needed. Not run in the PGlite tests (needs pg_cron).
select cron.unschedule('craftme-instagram-refresh');
