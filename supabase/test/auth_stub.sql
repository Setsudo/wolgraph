-- Test-only stand-in for the parts of Supabase's `auth` schema and roles that
-- 0001_init.sql depends on. Loaded into PGlite before the migrations; never
-- applied to a real Supabase project.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
end
$$;

create schema if not exists auth;

create table auth.users (
  id    uuid primary key,
  email text
);

-- Supabase's auth.uid() reads the JWT `sub` claim from the request settings.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
