-- Small named counters for the admin panel (e.g. the "likes ADDI" counter on
-- Devanshi's site). Incremented atomically by the server with the service role;
-- the public API keys can't read or write them.

create table if not exists public.admin_counters (
  key text primary key check (char_length(key) between 1 and 64),
  value bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.admin_counters enable row level security;
-- no policies: anon/authenticated get nothing

revoke all on public.admin_counters from anon, authenticated;
grant select, insert, update on public.admin_counters to service_role;

-- Atomic "add n and return the new total" (creates the counter on first use).
create or replace function public.increment_admin_counter(p_key text, p_by integer)
returns bigint
language sql
set search_path = public
as $$
  insert into public.admin_counters as c (key, value, updated_at)
  values (p_key, greatest(p_by, 0), now())
  on conflict (key) do update
    set value = c.value + greatest(excluded.value, 0),
        updated_at = now()
  returning c.value;
$$;

revoke all on function public.increment_admin_counter(text, integer) from public, anon, authenticated;
grant execute on function public.increment_admin_counter(text, integer) to service_role;
