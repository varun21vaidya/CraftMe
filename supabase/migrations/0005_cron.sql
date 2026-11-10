-- Scheduled jobs (pg_cron runs in UTC). The sweep is every time-based rule; the payout run drafts payouts on the 1st and 15th, 09:00 IST.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('craftme-sweep', '*/5 * * * *', 'select public.sweep()');
select cron.schedule('craftme-payout-run', '30 3 1,15 * *', 'select public._build_payout_run()');
