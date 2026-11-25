-- Site analytics for the admin panel.
--
-- analytics_daily / analytics_daily_breakdown are a copy of Vercel Web
-- Analytics numbers, written by the server's sync (service role) so the admin
-- can see history beyond Vercel's retention. analytics_interactions holds
-- first-party click counts (reel opens, contact clicks…) recorded by the site's
-- server through analytics_track(). The public API keys can't read or write
-- any of it.

create table if not exists public.analytics_daily (
  day date primary key,
  pageviews integer not null default 0 check (pageviews >= 0),
  -- unique per day (Vercel resets its visitor hash daily): don't sum across days as "people"
  visitors integer not null default 0 check (visitors >= 0),
  synced_at timestamptz not null default now(),
  -- when the per-dimension breakdown for this day was last fully written;
  -- final once it is later than the end of the day plus an hour
  breakdown_synced_at timestamptz null
);

create table if not exists public.analytics_daily_breakdown (
  day date not null,
  dimension text not null check (dimension in ('path', 'referrer', 'country', 'device', 'browser')),
  value text not null check (char_length(value) between 1 and 300),
  pageviews integer not null default 0 check (pageviews >= 0),
  visitors integer not null default 0 check (visitors >= 0),
  primary key (day, dimension, value)
);

create table if not exists public.analytics_interactions (
  day date not null,
  event text not null check (event ~ '^[a-z_]{1,32}$'),
  target text not null default '' check (char_length(target) <= 80),
  count bigint not null default 0 check (count >= 0),
  primary key (day, event, target)
);

alter table public.analytics_daily enable row level security;
alter table public.analytics_daily_breakdown enable row level security;
alter table public.analytics_interactions enable row level security;
-- no policies: anon/authenticated get nothing

revoke all on public.analytics_daily from anon, authenticated;
revoke all on public.analytics_daily_breakdown from anon, authenticated;
revoke all on public.analytics_interactions from anon, authenticated;
grant select, insert, update, delete on public.analytics_daily to service_role;
grant select, insert, update, delete on public.analytics_daily_breakdown to service_role;
grant select, insert, update, delete on public.analytics_interactions to service_role;

-- Count one interaction for today (UTC) and return the day's new total for
-- that (event, target). The table's checks reject unknown event shapes.
create or replace function public.analytics_track(p_event text, p_target text)
returns bigint
language sql
set search_path = public
as $$
  insert into public.analytics_interactions as i (day, event, target, count)
  values ((now() at time zone 'utc')::date, p_event, left(coalesce(p_target, ''), 80), 1)
  on conflict (day, event, target) do update
    set count = i.count + 1
  returning i.count;
$$;

revoke all on function public.analytics_track(text, text) from public, anon, authenticated;
grant execute on function public.analytics_track(text, text) to service_role;

-- Top p_limit values per dimension over [p_since, p_until] (null = unbounded),
-- summed across days and ranked by pageviews.
create or replace function public.analytics_breakdown(p_since date, p_until date, p_limit integer)
returns table (dimension text, value text, pageviews bigint, visitors bigint)
language sql
stable
set search_path = public
as $$
  select r.dimension, r.value, r.pageviews, r.visitors
  from (
    select s.dimension, s.value, s.pageviews, s.visitors,
           row_number() over (partition by s.dimension order by s.pageviews desc, s.visitors desc, s.value) as rn
    from (
      select b.dimension, b.value, sum(b.pageviews)::bigint as pageviews, sum(b.visitors)::bigint as visitors
      from public.analytics_daily_breakdown b
      where (p_since is null or b.day >= p_since)
        and (p_until is null or b.day <= p_until)
      group by b.dimension, b.value
    ) s
  ) r
  where r.rn <= greatest(coalesce(p_limit, 10), 0)
  order by r.dimension, r.pageviews desc, r.value;
$$;

revoke all on function public.analytics_breakdown(date, date, integer) from public, anon, authenticated;
grant execute on function public.analytics_breakdown(date, date, integer) to service_role;

-- Replace one day's rows for one dimension in a single transaction, so two
-- syncs running at once (a duplicated cron call, cron + "Sync now") can't
-- interleave their delete and insert. p_rows: [{"value","pageviews","visitors"}].
-- Duplicate values in p_rows are summed; returns the number of rows written.
create or replace function public.analytics_replace_breakdown(p_day date, p_dimension text, p_rows jsonb)
returns integer
language plpgsql
set search_path = public
as $$
declare
  written integer;
begin
  -- one replace per (day, dimension) at a time; released at commit
  perform pg_advisory_xact_lock(hashtext('analytics_replace_breakdown:' || p_day::text || ':' || p_dimension));

  delete from public.analytics_daily_breakdown b
  where b.day = p_day and b.dimension = p_dimension;

  insert into public.analytics_daily_breakdown as b (day, dimension, value, pageviews, visitors)
  select p_day, p_dimension, r.value,
         sum(greatest(coalesce(r.pageviews, 0), 0)),
         sum(greatest(coalesce(r.visitors, 0), 0))
  from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as r(value text, pageviews integer, visitors integer)
  where r.value is not null
  group by r.value
  on conflict (day, dimension, value) do update
    set pageviews = excluded.pageviews,
        visitors = excluded.visitors;

  get diagnostics written = row_count;
  return written;
end;
$$;

revoke all on function public.analytics_replace_breakdown(date, text, jsonb) from public, anon, authenticated;
grant execute on function public.analytics_replace_breakdown(date, text, jsonb) to service_role;

-- Top p_limit targets per event over [p_since, p_until] (null = unbounded).
-- event_total is the event's count over ALL its targets in the range (summed
-- before the ranking cut), so callers never undercount by adding up the top rows.
create or replace function public.analytics_interaction_summary(p_since date, p_until date, p_limit integer)
returns table (event text, target text, count bigint, event_total bigint)
language sql
stable
set search_path = public
as $$
  select r.event, r.target, r.total, r.event_total
  from (
    select s.event, s.target, s.total,
           (sum(s.total) over (partition by s.event))::bigint as event_total,
           row_number() over (partition by s.event order by s.total desc, s.target) as rn
    from (
      select i.event, i.target, sum(i.count)::bigint as total
      from public.analytics_interactions i
      where (p_since is null or i.day >= p_since)
        and (p_until is null or i.day <= p_until)
      group by i.event, i.target
    ) s
  ) r
  where r.rn <= greatest(coalesce(p_limit, 10), 0)
  order by r.event, r.total desc, r.target;
$$;

revoke all on function public.analytics_interaction_summary(date, date, integer) from public, anon, authenticated;
grant execute on function public.analytics_interaction_summary(date, date, integer) to service_role;
