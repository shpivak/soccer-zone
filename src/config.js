export const APP_CONFIG = {
  leagueDurationMonths: 3,
  tournamentsPerLeague: 12,
  teamsCount: 3,
  minPlayersPerTeam: 5,
  maxPlayersPerTeam: 7,
  roundsPerTournament: 4,
  gamesPerRound: 3,
  gamesPerTournament: 12,
  leagueName: 'Soccer Zone',
  leagues: [
    { id: 'friday-noon', name: 'שישי בצהריים' },
    { id: 'saturday-a', name: 'שבת A' },
    { id: 'saturday-b', name: 'שבת B' },
  ],
  points: {
    win: 3,
    draw: 1,
    loss: 0,
  },
  teamColors: ['black', 'yellow', 'pink'],
  allowedTeamColors: ['black', 'yellow', 'pink', 'orange', 'blue', 'gray'],
}
