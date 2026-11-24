-- The Instagram access token now lives only in the INSTAGRAM_ACCESS_TOKEN env
-- var (set in Vercel), and nothing fetched from Instagram is stored between
-- "Refresh" and "Update website". The integrations table added by
-- 20261125010000_integrations.sql held the token and the last fetch; it is no
-- longer read or written by the app, so it is dropped (with any stored token).

drop table if exists public.integrations;
