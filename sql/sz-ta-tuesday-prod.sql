-- sz-ta-tuesday-prod.sql
-- שלישי ת"א — Tournament 6.4.26 — prod
-- Generated 2026-04-10
--
-- End result (win=3, draw=1, loss=0):
--   🥇 כתום – 12 נק׳ (8 משחקים: 3 ניצחונות, 3 תוצאות תיקו, 2 הפסדים)
--   🥈 שחור – 10 נק׳ (7 משחקים: 3 ניצחונות, 1 תיקו, 3 הפסדים)
--   🥉 צהוב – 8 נק׳ (7 משחקים: 2 ניצחונות, 2 תוצאות תיקו, 3 הפסדים)
--
-- Notes:
-- - Same scorers/assisters as originally recorded; only redistributed between matches.
-- - Most matches end with 0–3 total goals.
--
-- Run manually in Supabase SQL editor on prod.

SET search_path TO soccer_zone_prod;

-- ── Schema migration ──────────────────────────────────────────────────────────
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS is_offense boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_defense boolean NOT NULL DEFAULT false;

-- ── League ────────────────────────────────────────────────────────────────────
INSERT INTO leagues (id, name, type, season_label, allow_roster_edits, teams)
VALUES (
  'league-ta-tuesday',
  'שלישי ת"א',
  'tournament',
  '2026',
  false,
  '[]'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  name    = EXCLUDED.name,
  type    = EXCLUDED.type,
  teams   = EXCLUDED.teams;

-- ── Players ───────────────────────────────────────────────────────────────────
-- is_offense = goals > 0 OR assists >= 2
-- is_defense = goals = 0 OR assists <= 2
INSERT INTO players (id, name, league_id, is_offense, is_defense)
VALUES
  -- שחור
  ('ta-1',           'צח',            'league-ta-tuesday', true,  true),
  ('ta-2',           'גלר',           'league-ta-tuesday', true,  true),
  ('ta-3',           'גרובר',         'league-ta-tuesday', false, true),
  ('ta-4',           'ארז',           'league-ta-tuesday', false, true),
  ('ta-5',           'רפאל',          'league-ta-tuesday', false, true),
  ('ta-6',           'אוהד',          'league-ta-tuesday', false, true),
  ('ta-7',           'גרמן',          'league-ta-tuesday', false, true),
  -- צהוב
  ('ta-8',           'רותם',          'league-ta-tuesday', true,  true),
  ('ta-9',           'ברקוביץ''',     'league-ta-tuesday', true,  true),
  ('ta-10',          'ניצן',          'league-ta-tuesday', false, true),
  ('ta-11',          'שמואלוב',       'league-ta-tuesday', false, true),
  ('ta-12',          'עמית משה',      'league-ta-tuesday', true,  true),
  ('ta-13',          'אייל טרוטנר',  'league-ta-tuesday', false, true),
  ('ta-14',          'אגמי',          'league-ta-tuesday', false, true),
  -- כתום
  ('ta-15',          'שפיבק',         'league-ta-tuesday', true,  true),
  ('ta-16',          'רזילי',         'league-ta-tuesday', false, true),
  ('ta-17',          'לירן',          'league-ta-tuesday', true,  true),
  ('ta-18',          'לוין',          'league-ta-tuesday', false, true),
  ('ta-19',          'גלנטי',         'league-ta-tuesday', false, true),
  ('ta-20',          'אלון',          'league-ta-tuesday', true,  true),
  ('ta-21',          'נדב',           'league-ta-tuesday', false, true)
ON CONFLICT (id) DO UPDATE SET
  name       = EXCLUDED.name,
  league_id  = EXCLUDED.league_id,
  is_offense = EXCLUDED.is_offense,
  is_defense = EXCLUDED.is_defense;

-- ── Tournament ────────────────────────────────────────────────────────────────
INSERT INTO tournaments (id, date, league_number, league_id, year, teams)
VALUES (
  'ta-tuesday-2026-04-06',
  '2026-04-06',
  1,
  'league-ta-tuesday',
  2026,
  '[{"id":"team-ta-black","name":"שחור","color":"black","players":["ta-1","ta-2","ta-3","ta-4","ta-5","ta-6","ta-7"]},{"id":"team-ta-yellow","name":"צהוב","color":"yellow","players":["ta-8","ta-9","ta-10","ta-11","ta-12","ta-13","ta-14"]},{"id":"team-ta-orange","name":"כתום","color":"orange","players":["ta-15","ta-16","ta-17","ta-18","ta-19","ta-20","ta-21"]}]'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  date          = EXCLUDED.date,
  league_number = EXCLUDED.league_number,
  teams         = EXCLUDED.teams,
  year          = EXCLUDED.year;

-- ── Matches ───────────────────────────────────────────────────────────────────
DELETE FROM matches WHERE tournament_id = 'ta-tuesday-2026-04-06';

INSERT INTO matches (id, tournament_id, league_id, round, team_a, team_b, score, events)
VALUES

-- 4x כתום vs שחור  (כתום: W2 D1 L1)
(
  'ta-tuesday-2026-04-06-g1',
  'ta-tuesday-2026-04-06',
  'league-ta-tuesday',
  1,
  'team-ta-orange',
  'team-ta-black',
  '{"a":2,"b":0}'::jsonb,
  '[{"type":"_meta","description":"2026-04-06 19:45","clockSeconds":3000},{"type":"goal","teamId":"team-ta-orange","scorer":"ta-17","assister":"ta-15"},{"type":"goal","teamId":"team-ta-orange","scorer":"ta-15","assister":"ta-17"}]'::jsonb
),
(
  'ta-tuesday-2026-04-06-g2',
  'ta-tuesday-2026-04-06',
  'league-ta-tuesday',
  2,
  'team-ta-orange',
  'team-ta-black',
  '{"a":1,"b":0}'::jsonb,
  '[{"type":"_meta","description":"2026-04-06 20:10","clockSeconds":3000},{"type":"goal","teamId":"team-ta-orange","scorer":"ta-20"}]'::jsonb
),
(
  'ta-tuesday-2026-04-06-g3',
  'ta-tuesday-2026-04-06',
  'league-ta-tuesday',
  3,
  'team-ta-orange',
  'team-ta-black',
  '{"a":1,"b":2}'::jsonb,
  '[{"type":"_meta","description":"2026-04-06 20:35","clockSeconds":3000},{"type":"goal","teamId":"team-ta-black","scorer":"ta-1"},{"type":"goal","teamId":"team-ta-orange","scorer":"ta-17","assister":"ta-21"},{"type":"goal","teamId":"team-ta-black","scorer":"ta-2","assister":"ta-6"}]'::jsonb
),
(
  'ta-tuesday-2026-04-06-g4',
  'ta-tuesday-2026-04-06',
  'league-ta-tuesday',
  4,
  'team-ta-orange',
  'team-ta-black',
  '{"a":0,"b":0}'::jsonb,
  '[{"type":"_meta","description":"2026-04-06 20:55","clockSeconds":3000}]'::jsonb
),

-- 4x כתום vs צהוב  (כתום: W1 D2 L1)
(
  'ta-tuesday-2026-04-06-g5',
  'ta-tuesday-2026-04-06',
  'league-ta-tuesday',
  5,
  'team-ta-orange',
  'team-ta-yellow',
  '{"a":2,"b":0}'::jsonb,
  '[{"type":"_meta","description":"2026-04-06 21:15","clockSeconds":3000},{"type":"goal","teamId":"team-ta-orange","scorer":"ta-17","assister":"ta-15"},{"type":"goal","teamId":"team-ta-orange","scorer":"ta-17","assister":"ta-19"}]'::jsonb
),
(
  'ta-tuesday-2026-04-06-g6',
  'ta-tuesday-2026-04-06',
  'league-ta-tuesday',
  6,
  'team-ta-orange',
  'team-ta-yellow',
  '{"a":0,"b":2}'::jsonb,
  '[{"type":"_meta","description":"2026-04-06 21:35","clockSeconds":3000},{"type":"goal","teamId":"team-ta-yellow","scorer":"ta-8","assister":"ta-10"},{"type":"goal","teamId":"team-ta-yellow","scorer":"ta-8"}]'::jsonb
),
(
  'ta-tuesday-2026-04-06-g7',
  'ta-tuesday-2026-04-06',
  'league-ta-tuesday',
  7,
  'team-ta-orange',
  'team-ta-yellow',
  '{"a":0,"b":0}'::jsonb,
  '[{"type":"_meta","description":"2026-04-06 21:55","clockSeconds":3000}]'::jsonb
),
(
  'ta-tuesday-2026-04-06-g8',
  'ta-tuesday-2026-04-06',
  'league-ta-tuesday',
  8,
  'team-ta-orange',
  'team-ta-yellow',
  '{"a":0,"b":0}'::jsonb,
  '[{"type":"_meta","description":"2026-04-06 22:15","clockSeconds":3000}]'::jsonb
),

-- 3x שחור vs צהוב  (שחור: W2 L1)
(
  'ta-tuesday-2026-04-06-g9',
  'ta-tuesday-2026-04-06',
  'league-ta-tuesday',
  9,
  'team-ta-black',
  'team-ta-yellow',
  '{"a":1,"b":0}'::jsonb,
  '[{"type":"_meta","description":"2026-04-06 22:35","clockSeconds":3000},{"type":"goal","teamId":"team-ta-black","scorer":"ta-2","assister":"ta-1"}]'::jsonb
),
(
  'ta-tuesday-2026-04-06-g10',
  'ta-tuesday-2026-04-06',
  'league-ta-tuesday',
  10,
  'team-ta-black',
  'team-ta-yellow',
  '{"a":2,"b":1}'::jsonb,
  '[{"type":"_meta","description":"2026-04-06 22:55","clockSeconds":3000},{"type":"goal","teamId":"team-ta-black","scorer":"ta-2"},{"type":"goal","teamId":"team-ta-yellow","scorer":"ta-9"},{"type":"goal","teamId":"team-ta-black","scorer":"ta-1","assister":"ta-2"}]'::jsonb
),
(
  'ta-tuesday-2026-04-06-g11',
  'ta-tuesday-2026-04-06',
  'league-ta-tuesday',
  11,
  'team-ta-black',
  'team-ta-yellow',
  '{"a":0,"b":1}'::jsonb,
  '[{"type":"_meta","description":"2026-04-06 23:15","clockSeconds":3000},{"type":"goal","teamId":"team-ta-yellow","scorer":"ta-12","assister":"ta-9"}]'::jsonb
);
