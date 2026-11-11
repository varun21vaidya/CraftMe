-- Unified Login hands out a business-level token that never expires, so the expiry becomes optional.
-- It also needs the client's business id and the person's app-scoped id (Meta's deauthorize and data-deletion
-- callbacks may name either that id or the Instagram account id).
alter table public.instagram_accounts
  alter column token_expires_at drop not null,
  add column client_business_id text,
  add column app_user_id text;
create index instagram_accounts_app_user on public.instagram_accounts (app_user_id);
