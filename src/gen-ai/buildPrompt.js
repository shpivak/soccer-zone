const lookupName = (id, players) => players.find((p) => p.id === id)?.name ?? ''

// IMPORTANT: prompts ask for a VISUAL BACKGROUND only — NO text in the image.
// Real Hebrew data is overlaid by the app using HTML (browser renders it correctly).

const NO_TEXT = 'CRITICAL: NO text, NO letters, NO numbers, NO labels anywhere in the image.'
const BASE = `${NO_TEXT} Square format (1:1). High quality. Dark background, green and gold accents.`

export const buildPrompt = (type, _data = {}) => {
  if (type === 'winning-team') {
    return (
      'Dark dramatic soccer "Team of the Week" celebration background. ' +
      'Large gold trophy silhouette centered in the image with light beams radiating outward. ' +
      'Gold and green confetti raining from the top. Bottom third: dark gradient band. ' +
      'Festive, energetic mood. ' + BASE
    )
  }

  if (type === 'mvp') {
    return (
      'Dark dramatic MVP soccer poster background. ' +
      'A single full-body player silhouette (no face) standing tall in the CENTER, ' +
      'golden spotlight rays coming from above, stars and light particles around the figure. ' +
      'Top quarter and bottom quarter: darker gradient bands with no decorative elements (leave empty). ' +
      BASE
    )
  }

  if (type === 'stats-table') {
    return (
      'Dark soccer statistics infographic background. Exact layout (top to bottom): ' +
      '(1) Top 10%: plain dark header strip. ' +
      '(2) Three equal horizontal dark card panels, each ~22% of total height, separated by thin gold lines. ' +
      'Each card: a small blurred action-player silhouette on the FAR LEFT 20% only; ' +
      'a single decorative icon (goal post / target / trophy respectively) on the FAR RIGHT 20% only; ' +
      'the CENTER 60% of every card must be plain dark background with NO decorations. ' +
      '(3) Bottom 24%: plain dark panel with a faint grid/table line pattern only (no figures). ' +
      BASE
    )
  }

  if (type === 'day-results') {
    return (
      'Dark energetic soccer match-day results poster background. ' +
      'Top third: bold dynamic light streaks and a large soccer ball in motion (blurred). ' +
      'Middle third: plain dark band — completely empty (leave blank for text). ' +
      'Bottom third: dark panel with faint horizontal divider lines only. ' +
      BASE
    )
  }

  if (type === 'squads') {
    return (
      'Dark soccer team roster background. ' +
      'The image is divided into equally-spaced vertical columns (one per team). ' +
      'Each column: a faint colored glow border only on the outer edges; ' +
      'the INTERIOR of each column must be plain dark background with NO decorations. ' +
      'Subtle soccer field texture on the very outer border of the whole image only. ' +
      BASE
    )
  }

  return 'Dark soccer celebration background. Soccer ball, green and gold glows, confetti. ' + BASE
}

// Returns structured data for the HTML overlay rendered on top of the background.
export const buildOverlayData = (type, { stats = [], leaders = {}, standings = [], league = null, session = null, players = [] } = {}) => {
  const leagueName = league?.name ?? 'Soccer Zone'

  if (type === 'winning-team') {
    const winner = standings[0]
    return { type: 'winning-team', leagueName, teamName: winner?.teamName ?? 'הקבוצה המנצחת', points: winner?.points ?? 0, wins: winner?.wins ?? 0 }
  }

  if (type === 'mvp') {
    const mvp = leaders?.mvp
    return { type: 'mvp', leagueName, name: mvp?.name ?? 'MVP', goals: mvp?.goals ?? 0, assists: mvp?.assists ?? 0, wins: mvp?.totalGamesWon ?? 0 }
  }

  if (type === 'stats-table') {
    const topScorer = [...stats].sort((a, b) => b.goals - a.goals)[0]
    const topAssister = [...stats].sort((a, b) => b.assists - a.assists)[0]
    return {
      type: 'stats-table', leagueName,
      topScorer: topScorer ? { name: topScorer.name, goals: topScorer.goals } : null,
      topAssister: topAssister ? { name: topAssister.name, assists: topAssister.assists } : null,
      mvpName: leaders?.mvp?.name ?? null,
      top3: standings.slice(0, 3),
    }
  }

  if (type === 'day-results') {
    return {
      type: 'day-results', leagueName,
      date: session?.date ?? '',
      gamesCount: (session?.games ?? []).filter((g) => g.played !== false).length,
      top3: standings.slice(0, 3),
    }
  }

  if (type === 'squads') {
    const teams = session?.teams ?? []
    return {
      type: 'squads', leagueName,
      teams: teams.map((t) => ({
        name: t.name, color: t.color ?? 'gray',
        players: (t.players ?? []).map((id) => lookupName(id, players)).filter(Boolean),
      })),
    }
  }

  return { type, leagueName }
}
