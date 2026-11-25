-- The admin header counter and login consent box were removed from the code
-- (commit 4660821). Drop their table and increment function; the stored count
-- is deleted with them.

drop function if exists public.increment_admin_counter(text, integer);
drop table if exists public.admin_counters;
