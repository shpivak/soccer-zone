# Soccer Zone

Small React app for managing an amateur soccer training league.

## Product Model

The hierarchy is:

- `League -> Tournament -> Games`

Current built-in leagues:

- `שישי בצהריים`
- `שבת א׳`
- `שבת ב׳`

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
- 2 games per round
- 8 total games per tournament
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
- Mock seed files live under `mock_data/`

That means each league has its own players, tournaments, standings, and stats.

## Development

Install dependencies:

```bash
npm install
```

Run the app:

```bash
npm run dev
```

Run lint:

```bash
npm run lint
```

Run end-to-end tests:

```bash
npm run test:e2e
```

## Current Notes

- Seed data is currently attached to `שישי בצהריים`
- `שבת ב׳` now includes a larger sample league dataset with players and tournaments
- `שבת א׳` is currently a good empty-state sandbox for creating a league from scratch
- The storage layer is localStorage today, with comments in place for a later Supabase migration
