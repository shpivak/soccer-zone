import defaultPlayersSource from '../../mock_data/players.json'
import tournamentOneSource from '../../mock_data/tournaments/tournament-1.json'
import tournamentTwoSource from '../../mock_data/tournaments/tournament-2.json'
import tournamentThreeSource from '../../mock_data/tournaments/tournament-3.json'
import tournamentFourSource from '../../mock_data/tournaments/tournament-4.json'
import tournamentFiveSource from '../../mock_data/tournaments/tournament-5.json'
import { LEAGUE_TYPES } from './leagueUtils'

const tournamentLeagueIdMap = {
  'friday-noon': 'tournament-1',
  'saturday-a': 'tournament-2',
  'saturday-b': 'tournament-3',
}

const clone = (value) => JSON.parse(JSON.stringify(value))

const mapLeagueId = (leagueId) => tournamentLeagueIdMap[leagueId] ?? leagueId

const migrateTeam = (team, index) => ({
  ...team,
  id: team.id ?? `team${index + 1}`,
  name: team.name ?? '',
})

const migrateGame = (game, index) => ({
  ...game,
  round: game.round ?? index + 1,
})

const tournamentPlayers = defaultPlayersSource.map((player) => ({
  ...player,
  leagueId: mapLeagueId(player.leagueId),
}))

const tournamentSessions = [
  tournamentOneSource,
  tournamentTwoSource,
  tournamentThreeSource,
  tournamentFourSource,
  tournamentFiveSource,
].map((session, index) => ({
  ...session,
  id: session.id ?? `session-${index + 1}`,
  leagueId: mapLeagueId(session.leagueId),
  teams: (session.teams ?? []).map(migrateTeam),
  games: (session.games ?? []).map(migrateGame),
}))

const regularLeagueId = 'regular-1'
const regularPlayers = [
  'נועם כהן',
  'עידו לוי',
  'איתי מזרחי',
  'אור בן עמי',
  'דור רפאלי',
  'רום פרץ',
  'יהב לוי',
  'רועי שרון',
  'אביב ששון',
  'ליאם חדד',
  'איליי יצחק',
  'שחר אברהם',
  'עמית בן חיים',
  'תומר סויסה',
  'עומר נחום',
  'נדב אלון',
].map((name, index) => ({
  id: `regular-p${index + 1}`,
  name,
  leagueId: regularLeagueId,
}))

const regularLeagueTeams = [
  {
    id: 'regular-team-1',
    name: 'נשרים',
    color: 'black',
    players: ['regular-p1', 'regular-p2', 'regular-p3', 'regular-p13'],
  },
  {
    id: 'regular-team-2',
    name: 'זאבים',
    color: 'yellow',
    players: ['regular-p4', 'regular-p5', 'regular-p6', 'regular-p14'],
  },
  {
    id: 'regular-team-3',
    name: 'דרקונים',
    color: 'pink',
    players: ['regular-p7', 'regular-p8', 'regular-p9', 'regular-p15'],
  },
  {
    id: 'regular-team-4',
    name: 'אריות',
    color: 'blue',
    players: ['regular-p10', 'regular-p11', 'regular-p12', 'regular-p16'],
  },
]

const regularSessions = [
  {
    id: 'regular-1-mw1',
    date: '2026-03-01',
    leagueNumber: 1,
    leagueId: regularLeagueId,
    year: 2026,
    teams: clone(regularLeagueTeams),
    games: [
      {
        id: 'regular-1-mw1-g1',
        round: 1,
        teamA: 'regular-team-1',
        teamB: 'regular-team-2',
        score: { a: 2, b: 1 },
        events: [
          { type: 'goal', scorer: 'regular-p1', assister: 'regular-p2' },
          { type: 'goal', scorer: 'regular-p2' },
          { type: 'goal', scorer: 'regular-p4' },
        ],
      },
      {
        id: 'regular-1-mw1-g2',
        round: 2,
        teamA: 'regular-team-3',
        teamB: 'regular-team-4',
        score: { a: 1, b: 1 },
        events: [
          { type: 'goal', scorer: 'regular-p7' },
          { type: 'goal', scorer: 'regular-p10', assister: 'regular-p11' },
        ],
      },
    ],
  },
  {
    id: 'regular-1-mw2',
    date: '2026-03-08',
    leagueNumber: 2,
    leagueId: regularLeagueId,
    year: 2026,
    teams: clone(regularLeagueTeams),
    games: [
      {
        id: 'regular-1-mw2-g1',
        round: 1,
        teamA: 'regular-team-1',
        teamB: 'regular-team-3',
        score: { a: 0, b: 1 },
        events: [{ type: 'goal', scorer: 'regular-p8', assister: 'regular-p7' }],
      },
      {
        id: 'regular-1-mw2-g2',
        round: 2,
        teamA: 'regular-team-2',
        teamB: 'regular-team-4',
        score: { a: 3, b: 0 },
        events: [
          { type: 'goal', scorer: 'regular-p4', assister: 'regular-p5' },
          { type: 'goal', scorer: 'regular-p5' },
          { type: 'goal', scorer: 'regular-p6' },
        ],
      },
    ],
  },
]

const friendlyLeagueId = 'friendly-1'
const friendlyPlayers = [
  'אדם לוי',
  'ניר דיין',
  'עומר זיו',
  'שקד עזר',
  'דניאל רון',
  'יואב הדר',
].map((name, index) => ({
  id: `friendly-p${index + 1}`,
  name,
  leagueId: friendlyLeagueId,
}))

const friendlySessions = [
  {
    id: 'friendly-1-day1',
    date: '2026-03-05',
    leagueNumber: 1,
    leagueId: friendlyLeagueId,
    year: 2026,
    teams: [
      { id: 'team1', color: 'black', name: '', players: ['friendly-p1', 'friendly-p2'] },
      { id: 'team2', color: 'yellow', name: '', players: ['friendly-p3', 'friendly-p4'] },
      { id: 'team3', color: 'pink', name: '', players: ['friendly-p5', 'friendly-p6'] },
    ],
    games: [
      {
        id: 'friendly-1-day1-g1',
        round: 1,
        teamA: 'team1',
        teamB: 'team2',
        score: { a: 1, b: 0 },
        events: [{ type: 'goal', scorer: 'friendly-p1', assister: 'friendly-p2' }],
      },
    ],
  },
]

export const defaultLeagues = [
  {
    id: 'tournament-1',
    name: 'שישי צהריים',
    type: LEAGUE_TYPES.tournament,
    seasonLabel: '2026',
    teams: [],
    allowRosterEdits: false,
  },
  {
    id: 'tournament-2',
    name: 'שבת A',
    type: LEAGUE_TYPES.tournament,
    seasonLabel: '2026',
    teams: [],
    allowRosterEdits: false,
  },
  {
    id: 'tournament-3',
    name: 'שבת B',
    type: LEAGUE_TYPES.tournament,
    seasonLabel: '2026',
    teams: [],
    allowRosterEdits: false,
  },
  {
    id: regularLeagueId,
    name: 'ליגת סוקרזון 5',
    type: LEAGUE_TYPES.regular,
    seasonLabel: '2026',
    teams: clone(regularLeagueTeams),
    allowRosterEdits: false,
  },
  {
    id: friendlyLeagueId,
    name: 'סטטיסטיקת ידידות',
    type: LEAGUE_TYPES.friendly,
    seasonLabel: '2026',
    teams: [],
    allowRosterEdits: false,
  },
]

export const defaultPlayers = [...tournamentPlayers, ...regularPlayers, ...friendlyPlayers]

export const defaultTournaments = [...tournamentSessions, ...regularSessions, ...friendlySessions]

export const getDefaultLeagueData = (leagueId) => ({
  league: clone(defaultLeagues.find((league) => league.id === leagueId) ?? null),
  players: defaultPlayers.filter((player) => player.leagueId === leagueId).map(clone),
  tournaments: defaultTournaments.filter((tournament) => tournament.leagueId === leagueId).map(clone),
})
