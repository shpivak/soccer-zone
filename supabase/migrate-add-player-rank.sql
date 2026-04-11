-- Migration: add `player_rank` column to players table
-- Named `player_rank` (not `rank`) because `rank` is a reserved PostgreSQL aggregate function.
-- Default value is 'B'; nullable (NULL means unset, app falls back to 'B' at render time).
-- Run this once per environment against Supabase.

-- Dev schema
ALTER TABLE soccer_zone_dev.players
  ADD COLUMN IF NOT EXISTS player_rank text DEFAULT 'B';

UPDATE soccer_zone_dev.players
SET player_rank = 'B'
WHERE player_rank IS NULL;

-- Test schema
ALTER TABLE soccer_zone_test.players
  ADD COLUMN IF NOT EXISTS player_rank text DEFAULT 'B';

UPDATE soccer_zone_test.players
SET player_rank = 'B'
WHERE player_rank IS NULL;

-- Prod schema
ALTER TABLE soccer_zone_prod.players
  ADD COLUMN IF NOT EXISTS player_rank text DEFAULT 'B';

UPDATE soccer_zone_prod.players
SET player_rank = 'B'
WHERE player_rank IS NULL;
