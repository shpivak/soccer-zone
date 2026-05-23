-- ─────────────────────────────────────────────────────────────────────────────
-- Soccer Lite — TEST schema setup
-- Paste this into the Supabase SQL editor and run it.
-- After it succeeds, expose the schema in:
--   Supabase Dashboard → API Settings → "Exposed schemas" → add soccerlite_test
--
-- NOTE: e2e tests (npm run lite:test:e2e) reset + reseed this schema before
-- every test run via liteTestDataHarness.js. The seed data below is only for
-- manual inspection and initial validation.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Schema
create schema if not exists soccerlite_test;

-- 2. Tables
create table if not exists soccerlite_test.leagues (
  id                 text        primary key,
  name               text        not null,
  type               text        not null    default 'tournament',
  season_label       text        not null    default '',
  allow_roster_edits boolean     not null    default false,
  teams              jsonb       not null    default '[]'::jsonb,
  admin_password     text        not null    default '',
  created_at         timestamptz not null    default timezone('utc', now())
);

create table if not exists soccerlite_test.players (
  id           text        primary key,
  name         text        not null,
  league_id    text        not null,
  is_offense   boolean     default null,
  is_defense   boolean     default null,
  player_rank  text        default 'B',
  created_at   timestamptz not null default timezone('utc', now())
);

create table if not exists soccerlite_test.tournaments (
  id             text        primary key,
  date           date        not null,
  league_number  integer     not null,
  league_id      text        not null,
  year           integer     not null,
  teams          jsonb       not null default '[]'::jsonb,
  created_at     timestamptz not null default timezone('utc', now()),
  updated_at     timestamptz not null default timezone('utc', now())
);

create table if not exists soccerlite_test.matches (
  id             text        primary key,
  tournament_id  text        references soccerlite_test.tournaments(id) on delete set null,
  league_id      text        not null,
  round          integer     not null default 1,
  team_a         text        not null,
  team_b         text        not null,
  score          jsonb       not null default '{"a":0,"b":0}'::jsonb,
  events         jsonb       not null default '[]'::jsonb,
  created_at     timestamptz not null default timezone('utc', now())
);

-- 3. Row-level security
alter table soccerlite_test.leagues     enable row level security;
alter table soccerlite_test.players     enable row level security;
alter table soccerlite_test.tournaments enable row level security;
alter table soccerlite_test.matches     enable row level security;

drop policy if exists "lite_test_leagues_full_access"     on soccerlite_test.leagues;
drop policy if exists "lite_test_players_full_access"     on soccerlite_test.players;
drop policy if exists "lite_test_tournaments_full_access" on soccerlite_test.tournaments;
drop policy if exists "lite_test_matches_full_access"     on soccerlite_test.matches;

create policy "lite_test_leagues_full_access"
  on soccerlite_test.leagues     for all to anon, authenticated using (true) with check (true);
create policy "lite_test_players_full_access"
  on soccerlite_test.players     for all to anon, authenticated using (true) with check (true);
create policy "lite_test_tournaments_full_access"
  on soccerlite_test.tournaments for all to anon, authenticated using (true) with check (true);
create policy "lite_test_matches_full_access"
  on soccerlite_test.matches     for all to anon, authenticated using (true) with check (true);

-- 4. Grants
grant usage on schema soccerlite_test to anon, authenticated, service_role;
grant all   on all tables in schema soccerlite_test to anon, authenticated, service_role;

comment on schema soccerlite_test is 'Soccer Lite test dataset — reset by e2e harness before every test run';

-- 5. Seed — test league
-- admin_password is SHA-256('test-password')
insert into soccerlite_test.leagues (id, name, type, admin_password)
values (
  'my-test-league',
  'My Test League',
  'tournament',
  'c638833f69bbfb3c267afa0a74434812436b8f08a81fd263c6be6871de4f1265'
)
on conflict (id) do update
  set name           = excluded.name,
      type           = excluded.type,
      admin_password = excluded.admin_password;

-- 6. Seed — sample players (enough to populate two teams for manual testing)
insert into soccerlite_test.players (id, name, league_id, player_rank) values
  ('tp-1',  'אלון כהן',     'my-test-league', 'A'),
  ('tp-2',  'יוסי לוי',     'my-test-league', 'B'),
  ('tp-3',  'דני מזרחי',    'my-test-league', 'B'),
  ('tp-4',  'רועי פרץ',     'my-test-league', 'A'),
  ('tp-5',  'שי בן דוד',    'my-test-league', 'B'),
  ('tp-6',  'עמית שטרן',    'my-test-league', 'C'),
  ('tp-7',  'גל אברהם',     'my-test-league', 'B'),
  ('tp-8',  'נועם כץ',      'my-test-league', 'A'),
  ('tp-9',  'תום ביטון',    'my-test-league', 'C'),
  ('tp-10', 'אור גולן',     'my-test-league', 'B')
on conflict (id) do update
  set name        = excluded.name,
      league_id   = excluded.league_id,
      player_rank = excluded.player_rank;

-- 7. Seed — one sample tournament day with two teams
insert into soccerlite_test.tournaments (id, date, league_number, league_id, year, teams)
values (
  'my-test-league-t1',
  current_date,
  1,
  'my-test-league',
  extract(year from current_date)::integer,
  '[
    {"id":"tt-black","color":"black","name":"","players":["tp-1","tp-2","tp-3","tp-4","tp-5"]},
    {"id":"tt-yellow","color":"yellow","name":"","players":["tp-6","tp-7","tp-8","tp-9","tp-10"]}
  ]'::jsonb
)
on conflict (id) do update
  set date          = excluded.date,
      league_number = excluded.league_number,
      teams         = excluded.teams;
