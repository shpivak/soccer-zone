create schema if not exists soccer_zone_prod;

create table if not exists soccer_zone_prod.players (
  id text primary key,
  name text not null,
  league_id text not null,
  is_offense boolean not null default false,
  is_defense boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists soccer_zone_prod.leagues (
  id text primary key,
  name text not null,
  type text not null,
  season_label text not null default '',
  allow_roster_edits boolean not null default false,
  teams jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists soccer_zone_prod.tournaments (
  id text primary key,
  date date not null,
  league_number integer not null,
  league_id text not null,
  year integer not null,
  teams jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists soccer_zone_prod.matches (
  id text primary key,
  tournament_id text references soccer_zone_prod.tournaments(id) on delete set null,
  league_id text not null,
  round integer not null default 1,
  team_a text not null,
  team_b text not null,
  score jsonb not null default '{"a":0,"b":0}'::jsonb,
  events jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

alter table soccer_zone_prod.players enable row level security;
alter table soccer_zone_prod.tournaments enable row level security;
alter table soccer_zone_prod.matches enable row level security;
alter table soccer_zone_prod.leagues enable row level security;

drop policy if exists "prod_players_read_write" on soccer_zone_prod.players;
drop policy if exists "prod_leagues_read_write" on soccer_zone_prod.leagues;
create policy "prod_leagues_read_write"
on soccer_zone_prod.leagues
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

drop policy if exists "prod_matches_read_write" on soccer_zone_prod.matches;
create policy "prod_matches_read_write"
on soccer_zone_prod.matches
for all
to anon, authenticated
using (true)
with check (true);

grant usage on schema soccer_zone_prod to anon, authenticated, service_role;
grant all on all tables in schema soccer_zone_prod to anon, authenticated, service_role;

comment on schema soccer_zone_prod is 'Soccer Zone production dataset';
