import { LEAGUE_TYPES, getTeamDisplayName } from './leagueUtils'

export const getGameWinner = (game) => {
  if (game.score.a > game.score.b) return game.teamA
  if (game.score.b > game.score.a) return game.teamB
  return null
}

const createStandingsRow = (team) => ({
  teamId: team.id,
  teamName: getTeamDisplayName(team),
  color: team.color,
  points: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  goalsFor: 0,
  goalsAgainst: 0,
  goalDiff: 0,
})

const applyGameToStandings = (standingsMap, game, pointsConfig) => {
  const teamAStats = standingsMap.get(game.teamA)
  const teamBStats = standingsMap.get(game.teamB)
  if (!teamAStats || !teamBStats) return

  teamAStats.goalsFor += game.score.a
  teamAStats.goalsAgainst += game.score.b
  teamBStats.goalsFor += game.score.b
  teamBStats.goalsAgainst += game.score.a

  if (game.score.a > game.score.b) {
    teamAStats.wins += 1
    teamBStats.losses += 1
    teamAStats.points += pointsConfig.win
    teamBStats.points += pointsConfig.loss
  } else if (game.score.b > game.score.a) {
    teamBStats.wins += 1
    teamAStats.losses += 1
    teamBStats.points += pointsConfig.win
    teamAStats.points += pointsConfig.loss
  } else {
    teamAStats.draws += 1
    teamBStats.draws += 1
    teamAStats.points += pointsConfig.draw
    teamBStats.points += pointsConfig.draw
  }
}

const toSortedStandings = (standingsMap) =>
  [...standingsMap.values()]
    .map((item) => ({ ...item, goalDiff: item.goalsFor - item.goalsAgainst }))
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.goalDiff - a.goalDiff ||
        b.goalsFor - a.goalsFor ||
        b.wins - a.wins ||
        a.teamName.localeCompare(b.teamName),
    )

export const calculateStandings = (session, pointsConfig) => {
  const standingsMap = new Map()
  session.teams.forEach((team) => standingsMap.set(team.id, createStandingsRow(team)))
  session.games.forEach((game) => applyGameToStandings(standingsMap, game, pointsConfig))
  return toSortedStandings(standingsMap)
}

export const calculateLeagueStandings = (league, sessions, pointsConfig) => {
  const teams = league.type === LEAGUE_TYPES.regular ? league.teams : sessions.flatMap((session) => session.teams)
  const standingsMap = new Map()
  teams.forEach((team) => {
    if (!standingsMap.has(team.id)) standingsMap.set(team.id, createStandingsRow(team))
  })
  sessions.forEach((session) => session.games.forEach((game) => applyGameToStandings(standingsMap, game, pointsConfig)))
  return toSortedStandings(standingsMap)
}

export const getTournamentWinnerTeamId = (session, pointsConfig) => {
  const standings = calculateStandings(session, pointsConfig)
  return standings[0]?.teamId ?? null
}

const basePlayerStats = (player) => ({
  playerId: player.id,
  name: player.name,
  isOffense: player.isOffense === true,
  isDefense: player.isDefense === true,
  sessionsParticipated: 0,
  sessionsWon: 0,
  totalGamesWon: 0,
  goals: 0,
  assists: 0,
  goalsConceded: 0,
  teamGoalsScored: 0,
  gamesPlayed: 0,
  defenderRatio: 0,
})

export const calculatePlayerStats = (players, sessions, pointsConfig, leagueType = LEAGUE_TYPES.tournament) => {
  const statsMap = new Map(players.map((player) => [player.id, basePlayerStats(player)]))

  sessions.forEach((session) => {
    const standings = calculateStandings(session, pointsConfig)
    const winnerTeamId = standings[0]?.teamId
    const teamGamesSummary = new Map()

    session.teams.forEach((team) => {
      teamGamesSummary.set(team.id, {
        wins: 0,
        goalsAgainst: 0,
        goalsFor: 0,
        games: 0,
      })
    })

    session.games.forEach((game) => {
      const teamA = teamGamesSummary.get(game.teamA)
      const teamB = teamGamesSummary.get(game.teamB)
      if (!teamA || !teamB) return

      teamA.games += 1
      teamB.games += 1
      teamA.goalsFor += game.score.a
      teamA.goalsAgainst += game.score.b
      teamB.goalsFor += game.score.b
      teamB.goalsAgainst += game.score.a

      const winner = getGameWinner(game)
      if (winner === game.teamA) teamA.wins += 1
      if (winner === game.teamB) teamB.wins += 1

      game.events.forEach((event) => {
        if (event.type !== 'goal') return
        const scorer = statsMap.get(event.scorer)
        if (scorer) scorer.goals += 1
        if (event.assister) {
          const assister = statsMap.get(event.assister)
          if (assister) assister.assists += 1
        }
      })
    })

    session.teams.forEach((team) => {
      const summary = teamGamesSummary.get(team.id)
      team.players.forEach((playerId) => {
        const playerStats = statsMap.get(playerId)
        if (!playerStats || !summary) return
        playerStats.sessionsParticipated += 1
        playerStats.totalGamesWon += summary.wins
        playerStats.goalsConceded += summary.goalsAgainst
        playerStats.teamGoalsScored += summary.goalsFor
        playerStats.gamesPlayed += summary.games
        if (leagueType === LEAGUE_TYPES.tournament && winnerTeamId === team.id) {
          playerStats.sessionsWon += 1
        }
      })
    })
  })

  return [...statsMap.values()]
    .map((player) => ({
      ...player,
      tournamentsParticipated: player.sessionsParticipated,
      tournamentsWon: player.sessionsWon,
      defenderRatio:
        player.gamesPlayed === 0 ? 0 : Number((player.goalsConceded / player.gamesPlayed).toFixed(2)),
    }))
    .sort(
      (a, b) =>
        b.sessionsWon - a.sessionsWon ||
        b.totalGamesWon - a.totalGamesWon ||
        b.goals - a.goals ||
        b.assists - a.assists ||
        a.name.localeCompare(b.name),
    )
}

export const getLeaders = (playerStats) => {
  const getTiedLeaders = (rows, metricSelector, compareFn = (a, b) => a === b) => {
    if (rows.length === 0) return []
    const leaderValue = metricSelector(rows[0])
    return rows.filter((row) => compareFn(metricSelector(row), leaderValue))
  }

  const mvp = playerStats[0] ?? null
  const sortedScorers = [...playerStats].sort((a, b) => b.goals - a.goals || b.assists - a.assists)
  const sortedAssisters = [...playerStats].sort((a, b) => b.assists - a.assists || b.goals - a.goals)
  const sortedDefenders = [...playerStats]
    .filter((item) => item.gamesPlayed > 0 && item.isDefense)
    .sort((a, b) => a.defenderRatio - b.defenderRatio || b.gamesPlayed - a.gamesPlayed)

  return {
    mvp,
    topScorers: getTiedLeaders(sortedScorers, (row) => row.goals),
    topAssisters: getTiedLeaders(sortedAssisters, (row) => row.assists),
    bestDefenders: getTiedLeaders(sortedDefenders, (row) => row.defenderRatio),
  }
}
