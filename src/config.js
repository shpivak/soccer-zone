export const APP_CONFIG = {
  defaultLeagueName: 'Soccer Zone',
  minTeams: 2,
  tournament: {
    teamsCount: 3,
    minPlayersPerTeam: 5,
    maxPlayersPerTeam: 7,
    maxTeams: 8,
    roundsPerSession: 4,
    gamesPerRound: 3,
    gamesPerSession: 12,
  },
  regular: {
    teamsCount: 4,
    maxTeams: 8,
    maxPlayersPerTeam: 9,
  },
  friendly: {
    teamsCount: 2,
    maxTeams: 8,
    maxPlayersPerTeam: 11,
  },
  points: {
    win: 3,
    draw: 1,
    loss: 0,
  },
  teamColors: ['black', 'yellow', 'pink', 'blue', 'orange', 'red', 'white'],
  allowedTeamColors: ['black', 'yellow', 'pink', 'orange', 'blue', 'red', 'gray', 'white'],
}
