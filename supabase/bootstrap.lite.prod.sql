create schema if not exists soccerlite_prod;

create table if not exists soccerlite_prod.leagues (
  id text primary key,
  name text not null,
  type text not null default 'tournament',
  season_label text not null default '',
  allow_roster_edits boolean not null default false,
  teams jsonb not null default '[]'::jsonb,
  admin_password text not null default '',
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists soccerlite_prod.players (
  id text primary key,
  name text not null,
  league_id text not null,
  is_offense boolean default null,
  is_defense boolean default null,
  player_rank text default 'B',
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists soccerlite_prod.tournaments (
  id text primary key,
  date date not null,
  league_number integer not null,
  league_id text not null,
  year integer not null,
  teams jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists soccerlite_prod.matches (
  id text primary key,
  tournament_id text references soccerlite_prod.tournaments(id) on delete set null,
  league_id text not null,
  round integer not null default 1,
  team_a text not null,
  team_b text not null,
  score jsonb not null default '{"a":0,"b":0}'::jsonb,
  events jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

alter table soccerlite_prod.leagues enable row level security;
alter table soccerlite_prod.players enable row level security;
alter table soccerlite_prod.tournaments enable row level security;
alter table soccerlite_prod.matches enable row level security;

drop policy if exists "lite_prod_leagues_full_access" on soccerlite_prod.leagues;
create policy "lite_prod_leagues_full_access"
on soccerlite_prod.leagues
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "lite_prod_players_full_access" on soccerlite_prod.players;
create policy "lite_prod_players_full_access"
on soccerlite_prod.players
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "lite_prod_tournaments_full_access" on soccerlite_prod.tournaments;
create policy "lite_prod_tournaments_full_access"
on soccerlite_prod.tournaments
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "lite_prod_matches_full_access" on soccerlite_prod.matches;
create policy "lite_prod_matches_full_access"
on soccerlite_prod.matches
for all
to anon, authenticated
using (true)
with check (true);

grant usage on schema soccerlite_prod to anon, authenticated, service_role;
grant all on all tables in schema soccerlite_prod to anon, authenticated, service_role;

comment on schema soccerlite_prod is 'Soccer Lite production dataset';
