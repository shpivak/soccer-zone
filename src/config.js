export const APP_CONFIG = {
  leagueDurationMonths: 3,
  tournamentsPerLeague: 12,
  teamsCount: 3,
  minPlayersPerTeam: 5,
  maxPlayersPerTeam: 7,
  roundsPerTournament: 4,
  gamesPerRound: 2,
  gamesPerTournament: 8,
  leagueName: 'Soccer Zone',
  leagues: [
    { id: 'friday-noon', name: 'שישי בצהריים' },
    { id: 'saturday-a', name: 'שבת א׳' },
    { id: 'saturday-b', name: 'שבת ב׳' },
  ],
  points: {
    win: 3,
    draw: 1,
    loss: 0,
  },
  teamColors: ['black', 'yellow', 'pink'],
  allowedTeamColors: ['black', 'yellow', 'pink', 'orange', 'blue', 'gray'],
}
