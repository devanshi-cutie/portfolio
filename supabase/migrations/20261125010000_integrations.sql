-- Third-party connections for the admin panel, one row per integration
-- (key "instagram": the long-lived Instagram API token, account id/username,
-- expiry and the last fetched snapshot). Holds secrets: only the server reads
-- or writes it, with the service role, after the admin session check. The
-- public API keys can't see it at all.

create table if not exists public.integrations (
  key text primary key check (char_length(key) between 1 and 64),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

drop trigger if exists integrations_touch on public.integrations;
create trigger integrations_touch before update on public.integrations
  for each row execute function public.touch_updated_at();

alter table public.integrations enable row level security;
-- no policies: anon/authenticated get nothing

revoke all on public.integrations from anon, authenticated;
grant select, insert, update, delete on public.integrations to service_role;
