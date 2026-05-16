const lookupName = (id, players) => players.find((p) => p.id === id)?.name ?? ''

// ── Shared style suffixes ────────────────────────────────────────────────────

const NO_TEXT = 'CRITICAL: NO text, NO letters, NO numbers, NO labels anywhere in the image.'
const BASE_STYLE = `${NO_TEXT} Square format (1:1). High quality. Dark background, green and gold accents.`

// ── Background-only prompts (used by Bg+Text mode, no-photo) ────────────────
// Gemini generates visual background; real data is overlaid by the app as HTML.

const buildBackgroundPrompt = (type) => {
  if (type === 'winning-team') {
    return (
      'Dark dramatic soccer "Team of the Week" celebration background. ' +
      'Large gold trophy silhouette centered with light beams radiating outward. ' +
      'Gold and green confetti raining from the top. Bottom third: dark gradient band. ' +
      BASE_STYLE
    )
  }
  if (type === 'mvp') {
    return (
      'Dark dramatic MVP soccer poster background. ' +
      'Single full-body player silhouette (no face) in a golden spotlight, ' +
      'dramatic rays of light, stars, soccer ball, glowing aura. ' +
      'Top and bottom quarters: darker gradient bands (leave empty). ' +
      BASE_STYLE
    )
  }
  if (type === 'stats-table') {
    return (
      'Dark soccer statistics infographic background. Layout (top to bottom): ' +
      '(1) Top 10%: plain dark header strip. ' +
      '(2) Three equal horizontal dark card panels each ~22% of height, separated by thin gold lines. ' +
      'Each card: blurred action-player silhouette on FAR LEFT 20%; decorative icon (goal post / target / trophy) on FAR RIGHT 20%; CENTER 60% plain dark. ' +
      '(3) Bottom 24%: plain dark panel with faint grid lines only. ' +
      BASE_STYLE
    )
  }
  if (type === 'day-results') {
    return (
      'Dark energetic soccer match-day results poster background. ' +
      'Top 15%: plain dark header strip. ' +
      'Middle 50%: plain dark band with very faint horizontal divider lines for match rows. ' +
      'Bottom 35%: dark panel with faint horizontal divider lines for standings rows. ' +
      BASE_STYLE
    )
  }
  if (type === 'squads') {
    return (
      'Dark soccer team roster background. ' +
      'Equally-spaced vertical columns, each with a faint colored glow border on outer edges only; ' +
      'interior of each column plain dark with NO decorations. ' +
      'Subtle soccer field texture on the very outer border only. ' +
      BASE_STYLE
    )
  }
  return 'Dark soccer celebration background. Soccer ball, green and gold glows, confetti. ' + BASE_STYLE
}

// ── Full-AI prompts (used by Full-AI mode, no-photo) ────────────────────────
// Gemini generates the entire image including text — Hebrew may be imperfect.

const buildFullAiPrompt = (type, { stats = [], leaders = {}, standings = [], league = null, session = null }) => {
  const leagueName = league?.name ?? 'Soccer Zone'
  const style = 'Dark background, green and gold accents, modern sports design, square format.'

  if (type === 'winning-team') {
    const winner = standings[0]
    const teamName = winner?.teamName ?? 'הקבוצה המנצחת'
    return (
      `Dramatic "Team of the Week" sports poster for team "${teamName}" in "${leagueName}". ` +
      `Show the team name and "🏆 קבוצת השבוע" prominently. ` +
      `Gold confetti, trophy, light beams. ${style}`
    )
  }
  if (type === 'mvp') {
    const mvp = leaders?.mvp
    const name = mvp?.name ?? 'MVP'
    return (
      `Dramatic MVP sports poster for player "${name}" in "${leagueName}". ` +
      `Stats: ${mvp?.goals ?? 0} goals, ${mvp?.assists ?? 0} assists, ${mvp?.totalGamesWon ?? 0} wins. ` +
      `Show "⭐ MVP" and the player name boldly. Gold spotlight, stars, no face — silhouette only. ${style}`
    )
  }
  if (type === 'stats-table') {
    const topScorer = [...stats].sort((a, b) => b.goals - a.goals)[0]
    const topAssister = [...stats].sort((a, b) => b.assists - a.assists)[0]
    const top3 = standings.slice(0, 3).map((r, i) => `${i + 1}. ${r.teamName} (${r.points}pts)`).join(', ')
    return (
      `Soccer season stats infographic for "${leagueName}". ` +
      `Top scorer: ${topScorer?.name ?? '-'} (${topScorer?.goals ?? 0} goals). ` +
      `Top assister: ${topAssister?.name ?? '-'} (${topAssister?.assists ?? 0} assists). ` +
      `MVP: ${leaders?.mvp?.name ?? '-'}. Standings: ${top3}. ` +
      `Three horizontal stat cards with icons, standings table below. ${style}`
    )
  }
  if (type === 'day-results') {
    const date = session?.date ?? ''
    const teams = session?.teams ?? []
    const teamById = Object.fromEntries(teams.map((t) => [t.id, t]))
    const playedGames = (session?.games ?? []).filter((g) => g.played !== false && g.score)
    const resultLines = playedGames
      .map((g) => `${teamById[g.teamA]?.name ?? g.teamA} ${g.score.a}–${g.score.b} ${teamById[g.teamB]?.name ?? g.teamB}`)
      .join(', ')
    const top3 = standings.slice(0, 3).map((r, i) => `${i + 1}. ${r.teamName} (${r.points}pts)`).join(', ')
    return (
      `Soccer match-day results poster for "${leagueName}"${date ? ` on ${date}` : ''}. ` +
      `Results: ${resultLines}. Standings: ${top3}. ` +
      `Bold "תוצאות היום" header, match scores and standings table. Dynamic, energetic design. ${style}`
    )
  }
  if (type === 'squads') {
    return (
      `Soccer team squads poster for "${leagueName}". ` +
      `Show team cards side by side with team names. Modern roster design. ${style}`
    )
  }
  return `Celebratory soccer poster for "${leagueName}". ${style}`
}

// ── Photo prompts (used when a photo is uploaded) ────────────────────────────
// Gemini receives the uploaded photo and decorates around it.

const buildPhotoBgPrompt = () =>
  'Use the uploaded photo as the large centerpiece of a sports poster. ' +
  'Add a dramatic gold and green decorative frame/border around it, confetti raining in from the top, ' +
  'light glow effects around the edges, and a small "Soccer Zone" logo badge in one corner. ' +
  'Do NOT alter, obscure, or modify the faces or people in the photo. Keep the photo prominent. ' +
  NO_TEXT

const buildPhotoFullAiPrompt = (type, data) => {
  const leagueName = data?.league?.name ?? 'Soccer Zone'
  let context = ''
  if (type === 'winning-team') context = `This is a Team of the Week celebration for "${data?.standings?.[0]?.teamName ?? ''}" in "${leagueName}".`
  else if (type === 'mvp') context = `This is an MVP award for "${data?.leaders?.mvp?.name ?? 'MVP'}" in "${leagueName}".`
  else if (type === 'day-results') context = `This is a match-day results poster for "${leagueName}".`
  else context = `This is a soccer poster for "${leagueName}".`

  return (
    `Use the uploaded photo as the large centerpiece of a sports poster. ${context} ` +
    'Add a dramatic gold and green decorative frame, confetti, light effects, ' +
    'and a small "Soccer Zone" logo badge in one corner. ' +
    'Do NOT alter, obscure, or modify the faces or people in the photo. Keep the photo prominent. ' +
    'Dark background, green and gold accents, modern sports design, square format.'
  )
}

// ── Public API ───────────────────────────────────────────────────────────────

export const buildPrompt = (type, data = {}, { fullAi = false, hasPhoto = false } = {}) => {
  if (hasPhoto) return fullAi ? buildPhotoFullAiPrompt(type, data) : buildPhotoBgPrompt()
  return fullAi ? buildFullAiPrompt(type, data) : buildBackgroundPrompt(type)
}

// Structured data for the HTML overlay (Bg+Text mode)
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
    const teams = session?.teams ?? []
    const teamById = Object.fromEntries(teams.map((t) => [t.id, t]))
    const playedGames = (session?.games ?? []).filter((g) => g.played !== false && g.score)
    const gameResults = playedGames.map((g) => ({
      teamA: teamById[g.teamA]?.name ?? g.teamA,
      teamB: teamById[g.teamB]?.name ?? g.teamB,
      scoreA: g.score.a,
      scoreB: g.score.b,
    }))
    return {
      type: 'day-results', leagueName,
      date: session?.date ?? '',
      gameResults,
      standings: standings.map((r, i) => ({ rank: i + 1, teamName: r.teamName, points: r.points, goalDiff: r.goalDiff ?? 0 })),
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

// Field definitions for overlay checkboxes (Bg+Text mode)
export const OVERLAY_FIELDS = {
  'winning-team': [
    { key: 'teamName', label: 'שם הקבוצה' },
    { key: 'wins', label: 'ניצחונות' },
    { key: 'points', label: 'נקודות' },
  ],
  'mvp': [
    { key: 'name', label: 'שם שחקן' },
    { key: 'goals', label: 'שערים' },
    { key: 'assists', label: 'בישולים' },
    { key: 'wins', label: 'ניצחונות' },
  ],
  'stats-table': [
    { key: 'topScorer', label: 'מלך שערים' },
    { key: 'topAssister', label: 'מלך בישולים' },
    { key: 'mvpName', label: 'MVP' },
    { key: 'standings', label: 'טבלת מצב' },
    { key: 'leagueName', label: 'שם ליגה' },
  ],
  'day-results': [
    { key: 'date', label: 'תאריך' },
    { key: 'gameResults', label: 'תוצאות משחקים' },
    { key: 'standings', label: 'טבלת מצב' },
  ],
  'squads': [], // built dynamically from teams
}
