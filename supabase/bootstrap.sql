create schema if not exists soccer_zone_test;
create schema if not exists soccer_zone_prod;

create table if not exists soccer_zone_test.players (
  id text primary key,
  name text not null,
  league_id text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists soccer_zone_test.tournaments (
  id text primary key,
  date date not null,
  league_number integer not null,
  league_id text not null,
  year integer not null,
  teams jsonb not null default '[]'::jsonb,
  games jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists soccer_zone_prod.players (
  id text primary key,
  name text not null,
  league_id text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists soccer_zone_prod.tournaments (
  id text primary key,
  date date not null,
  league_number integer not null,
  league_id text not null,
  year integer not null,
  teams jsonb not null default '[]'::jsonb,
  games jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table soccer_zone_test.players enable row level security;
alter table soccer_zone_test.tournaments enable row level security;
alter table soccer_zone_prod.players enable row level security;
alter table soccer_zone_prod.tournaments enable row level security;

drop policy if exists "test_players_full_access" on soccer_zone_test.players;
create policy "test_players_full_access"
on soccer_zone_test.players
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "test_tournaments_full_access" on soccer_zone_test.tournaments;
create policy "test_tournaments_full_access"
on soccer_zone_test.tournaments
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "prod_players_read_write" on soccer_zone_prod.players;
create policy "prod_players_read_write"
on soccer_zone_prod.players
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "prod_tournaments_read_write" on soccer_zone_prod.tournaments;
create policy "prod_tournaments_read_write"
on soccer_zone_prod.tournaments
for all
to anon, authenticated
using (true)
with check (true);

grant usage on schema soccer_zone_test to anon, authenticated, service_role;
grant usage on schema soccer_zone_prod to anon, authenticated, service_role;
grant all on all tables in schema soccer_zone_test to anon, authenticated, service_role;
grant all on all tables in schema soccer_zone_prod to anon, authenticated, service_role;

comment on schema soccer_zone_test is 'Soccer Zone non-production dataset';
comment on schema soccer_zone_prod is 'Soccer Zone production dataset';
