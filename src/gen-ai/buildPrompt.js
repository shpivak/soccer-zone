const lookupName = (id, players) => players.find((p) => p.id === id)?.name ?? ''

// Prompts ask for a VISUAL BACKGROUND only — no text in the image.
// The actual Hebrew data is overlaid by the app using HTML (browser renders it correctly).

const BASE_STYLE =
  'Dark background. Green and gold accents. Modern sports aesthetic. ' +
  'NO text, NO letters, NO numbers, NO labels anywhere in the image. ' +
  'Square format (1:1 aspect ratio). High quality.'

export const buildPrompt = (type, _data = {}) => {
  if (type === 'winning-team') {
    return (
      'Create a dramatic celebratory soccer "Team of the Week" poster background. ' +
      'Gold confetti raining down, dramatic light beams in green and gold, large trophy silhouette in center, ' +
      'soccer ball elements, sparkles and stars. Festive and energetic mood. ' +
      BASE_STYLE
    )
  }

  if (type === 'mvp') {
    return (
      'Create a dramatic MVP spotlight soccer poster background. ' +
      'Single player full-body silhouette (no face) in a golden spotlight, ' +
      'dramatic rays of light, stars, soccer ball, glowing aura effect. Heroic and powerful mood. ' +
      BASE_STYLE
    )
  }

  if (type === 'stats-table') {
    return (
      'Create a soccer season statistics infographic background layout. ' +
      'Three distinct horizontal dark card/panel areas stacked vertically with subtle gold borders, ' +
      'then a leaderboard table area at the bottom with row dividers. ' +
      'Green and gold glow effects, subtle soccer field pattern. Clean and structured. ' +
      BASE_STYLE
    )
  }

  if (type === 'day-results') {
    return (
      'Create an energetic soccer match day results poster background. ' +
      'Dynamic action lines, soccer ball motion blur, green and gold light streaks, ' +
      'subtle stadium silhouette. Bold and exciting mood. ' +
      BASE_STYLE
    )
  }

  if (type === 'squads') {
    return (
      'Create a soccer team roster background with multiple distinct card zones side by side. ' +
      'Each card zone has a subtle colored glow border in a different team color. ' +
      'Soccer field texture in background, clean modern design. ' +
      BASE_STYLE
    )
  }

  return (
    'Create a celebratory soccer background. Soccer ball, green and gold, modern sports design, confetti. ' +
    BASE_STYLE
  )
}

// Returns the structured data to overlay on top of the background image.
export const buildOverlayData = (type, { stats = [], leaders = {}, standings = [], league = null, session = null, players = [] } = {}) => {
  const leagueName = league?.name ?? 'Soccer Zone'

  if (type === 'winning-team') {
    const winner = standings[0]
    return {
      type: 'winning-team',
      leagueName,
      teamName: winner?.teamName ?? 'הקבוצה המנצחת',
      points: winner?.points ?? 0,
      wins: winner?.wins ?? 0,
    }
  }

  if (type === 'mvp') {
    const mvp = leaders?.mvp
    return {
      type: 'mvp',
      leagueName,
      name: mvp?.name ?? 'MVP',
      goals: mvp?.goals ?? 0,
      assists: mvp?.assists ?? 0,
      wins: mvp?.totalGamesWon ?? 0,
    }
  }

  if (type === 'stats-table') {
    const topScorer = [...stats].sort((a, b) => b.goals - a.goals)[0]
    const topAssister = [...stats].sort((a, b) => b.assists - a.assists)[0]
    return {
      type: 'stats-table',
      leagueName,
      topScorer: topScorer ? { name: topScorer.name, goals: topScorer.goals } : null,
      topAssister: topAssister ? { name: topAssister.name, assists: topAssister.assists } : null,
      mvpName: leaders?.mvp?.name ?? null,
      top3: standings.slice(0, 3),
    }
  }

  if (type === 'day-results') {
    return {
      type: 'day-results',
      leagueName,
      date: session?.date ?? '',
      gamesCount: (session?.games ?? []).filter((g) => g.played !== false).length,
      top3: standings.slice(0, 3),
    }
  }

  if (type === 'squads') {
    const teams = session?.teams ?? []
    return {
      type: 'squads',
      leagueName,
      teams: teams.map((t) => ({
        name: t.name,
        color: t.color ?? 'gray',
        players: (t.players ?? []).map((id) => lookupName(id, players)).filter(Boolean),
      })),
    }
  }

  return { type, leagueName }
}
