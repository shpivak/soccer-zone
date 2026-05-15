-- Keep only the first fixture in league-1774968768010; delete all others.
-- Run against the dev schema (soccer_zone_dev).

-- 1. Delete matches that belong to any tournament in this league EXCEPT the one to keep
DELETE FROM soccer_zone_dev.matches
WHERE league_id = 'league-1774968768010'
  AND tournament_id <> 'league-1774968768010-1774968794480';

-- 2. Delete the unwanted tournament rows themselves
DELETE FROM soccer_zone_dev.tournaments
WHERE league_id = 'league-1774968768010'
  AND id <> 'league-1774968768010-1774968794480';
