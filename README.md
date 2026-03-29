# Soccer Zone

Small React app for managing an amateur soccer training league.

## Storage

The app now supports two storage modes:

- `supabase`: the app reads and writes directly to Supabase REST from the browser
- `local`: fallback mode for local development before credentials are configured

Supabase is the intended primary path. The old `mock_data/` files are now seed input for the one-time migration and for test resets.

## Product Model

The hierarchy is:

- `League -> Tournament -> Games`

Current built-in leagues:

- `שישי בצהריים`
- `שבת A`
- `שבת B`

The league selector is the top-level filter in the UI:

- In `Live` mode it filters the tournament list and all player/team actions.
- In `Stats` mode it filters the MVP table and all aggregated leaderboards.

## Rules And Defaults

All numbers are configurable in `src/config.js`. The current defaults are:

- 1 league period = 3 months
- 12 tournaments per league period
- 3 teams per tournament
- 5-7 players per team
- 4 rounds per tournament
- 3 games per round
- 12 total games per tournament
- Points: win = 3, draw = 1, loss = 0

## App Modes

### 1. Live Tournament Mode

Used during a single tournament day.

- Select a league first
- Select or create a tournament inside that league
- Build the 3 teams for that tournament day
- Record each game with:
  - teams
  - final score
  - scorers
  - assisters
- Live standings are calculated from the configured points system
- The tournament winner is the team with the most points at the end of the day

Current validation:

- A player cannot be on two teams in the same tournament
- A team cannot exceed the configured max players per team

### 2. Stats Mode

Aggregates results for the selected league only.

Primary MVP ranking:

- Most tournaments won
- If tied: most game wins
- If still tied: most tournaments participated in

Additional leaders:

- Top scorer
- Top assister
- Best defender = lowest goals conceded / games played

When possible, the headline awards are spread across different players, so MVP, top scorer, and top assister are not all assigned to the same person.

## Data Shape

The data model is league-aware:

- Players belong to a `leagueId`
- Tournaments belong to a `leagueId`
- Games belong to a tournament
- Seed files live under `mock_data/`

That means each league has its own players, tournaments, standings, and stats.

## Supabase Layout

The project expects three PostgreSQL schemas:

- `soccer_zone_dev`
- `soccer_zone_test`
- `soccer_zone_prod`

`soccer_zone_dev` is the default dataset for local development and (eventually) sample users.

`soccer_zone_test` is reserved for automated test suites (e2e). `soccer_zone_prod` should remain empty until you are ready.

Tables per schema:

- `players`
- `tournaments`

`teams` and `games` are stored as `jsonb` columns inside `tournaments`, which keeps the current frontend model intact and makes the REST migration much smaller.

Bootstrap SQL lives under `supabase/`:

- `supabase/bootstrap.dev.sql`
- `supabase/bootstrap.test.sql`
- `supabase/bootstrap.prod.sql`

Important Supabase setup notes:

- Add `soccer_zone_dev`, `soccer_zone_test`, and `soccer_zone_prod` to Supabase API exposed schemas
- Use the project URL for REST: `https://gubuvqsutilhsmgxsghq.supabase.co`
- Use the anon/publishable key in the browser
- Use the service-role key only for scripts and test reset/seed flows

## Environment Variables

Copy [`.env.example`](/Users/hadarshpivak/projects/h_github/soccer-zone/.env.example) to `.env` or `.env.local` and fill in the secrets.

Browser config:

- `VITE_STORAGE_PROVIDER=supabase`
- `VITE_SUPABASE_URL=...`
- `VITE_SUPABASE_ANON_KEY=...`
- `VITE_SUPABASE_DEV_SCHEMA=soccer_zone_dev`
- `VITE_SUPABASE_TEST_SCHEMA=soccer_zone_test`
- `VITE_SUPABASE_PROD_SCHEMA=soccer_zone_prod`
- `VITE_DEFAULT_DATASET=dev` (fixed at **build time**; there is no dev/test switcher in the UI — GitHub Pages builds use `dev`; Playwright/CI builds use `test` via `npm run test:e2e`)
- `VITE_ENABLE_PROD_DATASET=false`
- `VITE_ENABLE_TEST_RESET=true`
- `VITE_ENABLE_PROD_RESET=false`

Script and test config:

- `SUPABASE_URL=...`
- `SUPABASE_SERVICE_ROLE_KEY=...`
- `SUPABASE_DEV_SCHEMA=soccer_zone_dev`
- `SUPABASE_TEST_SCHEMA=soccer_zone_test`
- `SUPABASE_PROD_SCHEMA=soccer_zone_prod`
- `ALLOW_PROD_DB_RESET=false`

## One-Time Migration

1. Apply [`supabase/bootstrap.sql`](/Users/hadarshpivak/projects/h_github/soccer-zone/supabase/bootstrap.sql) in the Supabase SQL editor, or through `psql` if you prefer using the connection string.
2. Add the browser and script environment variables.
3. Seed the test schema from the existing mock files:

```bash
npm run db:seed:test
```

That script:

- resets only the selected dataset
- defaults to `test`
- refuses to touch `prod` unless `ALLOW_PROD_DB_RESET=true`

Reset the test schema and immediately re-seed it:

```bash
npm run db:reset:test
```

Clear the dev schema (no seeding):

```bash
npm run db:reset:dev
```

## Dataset Behavior

Which Supabase schema the app uses is determined only by **`VITE_DEFAULT_DATASET`** at build time (`dev` | `test`, or `prod` when `VITE_ENABLE_PROD_DATASET=true`). There is no in-app dataset toggle.

- **Local / GitHub Pages:** use `VITE_DEFAULT_DATASET=dev` (see [`.github/workflows/deploy-pages.yml`](/Users/hadarshpivak/projects/h_github/soccer-zone/.github/workflows/deploy-pages.yml)).
- **E2E / CI:** must run with `VITE_DEFAULT_DATASET=test` (the `npm run test:e2e` script sets this; [`.github/workflows/ci.yml`](/Users/hadarshpivak/projects/h_github/soccer-zone/.github/workflows/ci.yml) sets it too). Playwright fails fast if this is missing or wrong.
- **Prod** remains opt-in via `VITE_ENABLE_PROD_DATASET` and `VITE_DEFAULT_DATASET=prod`.
- League clear/reset tools follow the same flags as before (`ENABLE_*_RESET`).

The admin panel in the UI is enabled by default and works per selected league:

- `נקה ליגה` clears the selected league's players and tournaments after confirmation
- `שחזר mock data` restores the selected league from `mock_data/` after confirmation (only when the build uses the `test` dataset)

## Development

Install dependencies:

```bash
npm install
```

Run the app:

```bash
npm run dev
```

Run the app against Supabase:

```bash
VITE_STORAGE_PROVIDER=supabase npm run dev
```

Run lint:

```bash
npm run lint
```

Run end-to-end tests (requires `VITE_DEFAULT_DATASET=test`; the npm script sets it):

```bash
npm run test:e2e
```

To run e2e against the Supabase test schema instead of local fallback mode, set:

- `VITE_STORAGE_PROVIDER=supabase`
- `SUPABASE_SERVICE_ROLE_KEY=...`

The Playwright suite resets and re-seeds the `test` schema before each test when Supabase mode is active. Parallel execution was disabled so the shared test schema stays deterministic.

## Current Notes

- Seed data is currently attached to `שישי בצהריים`
- `שבת B` now includes a larger sample league dataset with players and tournaments
- `שבת A` is currently a good empty-state sandbox for creating a league from scratch
- Browser writes are direct REST calls today, so this setup is convenient but not hardened like a backend-protected admin flow
