export const APP_CONFIG = {
  defaultLeagueName: 'Soccer Zone',
  tournament: {
    teamsCount: 3,
    minPlayersPerTeam: 5,
    maxPlayersPerTeam: 7,
    roundsPerSession: 4,
    gamesPerRound: 3,
    gamesPerSession: 12,
  },
  regular: {
    maxTeams: 8,
    maxPlayersPerTeam: 9,
  },
  friendly: {
    teamsCount: 3,
    maxPlayersPerTeam: 7,
  },
  points: {
    win: 3,
    draw: 1,
    loss: 0,
  },
  teamColors: ['black', 'yellow', 'pink'],
  allowedTeamColors: ['black', 'yellow', 'pink', 'orange', 'blue', 'gray'],
}
