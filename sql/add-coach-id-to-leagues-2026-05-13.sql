-- Add coach_id column to leagues table in all schemas
-- Run this once against the Supabase project before deploying the matching app version.

ALTER TABLE soccer_zone_dev.leagues  ADD COLUMN IF NOT EXISTS coach_id text;
ALTER TABLE soccer_zone_test.leagues ADD COLUMN IF NOT EXISTS coach_id text;
ALTER TABLE soccer_zone_prod.leagues ADD COLUMN IF NOT EXISTS coach_id text;
