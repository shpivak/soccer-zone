create schema if not exists soccer_zone_dev;

create table if not exists soccer_zone_dev.leagues (
  id text primary key,
  name text not null,
  type text not null,
  season_label text not null default '',
  allow_roster_edits boolean not null default false,
  teams jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists soccer_zone_dev.players (
  id text primary key,
  name text not null,
  league_id text not null,
  is_offense boolean default null,
  is_defense boolean default null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists soccer_zone_dev.tournaments (
  id text primary key,
  date date not null,
  league_number integer not null,
  league_id text not null,
  year integer not null,
  teams jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists soccer_zone_dev.matches (
  id text primary key,
  tournament_id text references soccer_zone_dev.tournaments(id) on delete set null,
  league_id text not null,
  round integer not null default 1,
  team_a text not null,
  team_b text not null,
  score jsonb not null default '{"a":0,"b":0}'::jsonb,
  events jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

alter table soccer_zone_dev.players enable row level security;
alter table soccer_zone_dev.tournaments enable row level security;
alter table soccer_zone_dev.matches enable row level security;
alter table soccer_zone_dev.leagues enable row level security;

drop policy if exists "dev_leagues_full_access" on soccer_zone_dev.leagues;
create policy "dev_leagues_full_access"
on soccer_zone_dev.leagues
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "dev_players_full_access" on soccer_zone_dev.players;
create policy "dev_players_full_access"
on soccer_zone_dev.players
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "dev_tournaments_full_access" on soccer_zone_dev.tournaments;
create policy "dev_tournaments_full_access"
on soccer_zone_dev.tournaments
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "dev_matches_full_access" on soccer_zone_dev.matches;
create policy "dev_matches_full_access"
on soccer_zone_dev.matches
for all
to anon, authenticated
using (true)
with check (true);

grant usage on schema soccer_zone_dev to anon, authenticated, service_role;
grant all on all tables in schema soccer_zone_dev to anon, authenticated, service_role;

comment on schema soccer_zone_dev is 'Soccer Zone dev dataset for local development and sample users';
