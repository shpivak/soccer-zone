import defaultPlayers from '../../mock_data/players.json'
import tournamentOne from '../../mock_data/tournaments/tournament-1.json'
import tournamentTwo from '../../mock_data/tournaments/tournament-2.json'
import tournamentThree from '../../mock_data/tournaments/tournament-3.json'
import tournamentFour from '../../mock_data/tournaments/tournament-4.json'
import tournamentFive from '../../mock_data/tournaments/tournament-5.json'

export const defaultTournaments = [tournamentOne, tournamentTwo, tournamentThree, tournamentFour, tournamentFive]
export { defaultPlayers }

export const getDefaultLeagueData = (leagueId) => ({
  players: defaultPlayers.filter((player) => player.leagueId === leagueId),
  tournaments: defaultTournaments.filter((tournament) => tournament.leagueId === leagueId),
})
