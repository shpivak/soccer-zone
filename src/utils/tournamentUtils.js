export const getGameWinner = (game) => {
  if (game.score.a > game.score.b) return game.teamA
  if (game.score.b > game.score.a) return game.teamB
  return null
}

export const calculateStandings = (tournament, pointsConfig) => {
  const standingsMap = new Map()

  tournament.teams.forEach((team) => {
    standingsMap.set(team.id, {
      teamId: team.id,
      color: team.color,
      points: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDiff: 0,
    })
  })

  tournament.games.forEach((game) => {
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
  })

  return [...standingsMap.values()]
    .map((item) => ({ ...item, goalDiff: item.goalsFor - item.goalsAgainst }))
    .sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff || b.wins - a.wins)
}

export const getTournamentWinnerTeamId = (tournament, pointsConfig) => {
  const standings = calculateStandings(tournament, pointsConfig)
  return standings[0]?.teamId ?? null
}

const basePlayerStats = (player) => ({
  playerId: player.id,
  name: player.name,
  tournamentsParticipated: 0,
  tournamentsWon: 0,
  totalGamesWon: 0,
  goals: 0,
  assists: 0,
  goalsConceded: 0,
  teamGoalsScored: 0,
  gamesPlayed: 0,
  defenderRatio: 0,
})

export const calculatePlayerStats = (players, tournaments, pointsConfig) => {
  const statsMap = new Map(players.map((player) => [player.id, basePlayerStats(player)]))

  tournaments.forEach((tournament) => {
    const standings = calculateStandings(tournament, pointsConfig)
    const winnerTeamId = standings[0]?.teamId
    const teamGamesSummary = new Map()

    tournament.teams.forEach((team) => {
      teamGamesSummary.set(team.id, {
        wins: 0,
        goalsAgainst: 0,
        goalsFor: 0,
        games: 0,
      })
    })

    tournament.games.forEach((game) => {
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

    tournament.teams.forEach((team) => {
      const summary = teamGamesSummary.get(team.id)
      team.players.forEach((playerId) => {
        const playerStats = statsMap.get(playerId)
        if (!playerStats || !summary) return
        playerStats.tournamentsParticipated += 1
        playerStats.totalGamesWon += summary.wins
        playerStats.goalsConceded += summary.goalsAgainst
        playerStats.teamGoalsScored += summary.goalsFor
        playerStats.gamesPlayed += summary.games
        if (winnerTeamId === team.id) playerStats.tournamentsWon += 1
      })
    })
  })

  return [...statsMap.values()]
    .map((player) => ({
      ...player,
      defenderRatio:
        player.gamesPlayed === 0 ? 0 : Number((player.goalsConceded / player.gamesPlayed).toFixed(2)),
    }))
    .sort(
      (a, b) =>
        b.tournamentsWon - a.tournamentsWon ||
        b.totalGamesWon - a.totalGamesWon ||
        b.tournamentsParticipated - a.tournamentsParticipated,
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
    .filter((item) => item.gamesPlayed > 0)
    .sort((a, b) => a.defenderRatio - b.defenderRatio || b.gamesPlayed - a.gamesPlayed)

  return {
    mvp,
    topScorers: getTiedLeaders(sortedScorers, (row) => row.goals),
    topAssisters: getTiedLeaders(sortedAssisters, (row) => row.assists),
    bestDefenders: getTiedLeaders(sortedDefenders, (row) => row.defenderRatio),
  }
}
