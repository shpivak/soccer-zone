import players from '../../mock_data/players.json' with { type: 'json' }
import tournamentOne from '../../mock_data/tournaments/tournament-1.json' with { type: 'json' }
import tournamentTwo from '../../mock_data/tournaments/tournament-2.json' with { type: 'json' }
import tournamentThree from '../../mock_data/tournaments/tournament-3.json' with { type: 'json' }
import tournamentFour from '../../mock_data/tournaments/tournament-4.json' with { type: 'json' }
import tournamentFive from '../../mock_data/tournaments/tournament-5.json' with { type: 'json' }

export const defaultPlayers = players
export const defaultTournaments = [tournamentOne, tournamentTwo, tournamentThree, tournamentFour, tournamentFive]
