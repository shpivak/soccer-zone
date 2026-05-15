const lookupName = (id, players) => players.find((p) => p.id === id)?.name ?? ''

// Appended to every prompt to ensure Hebrew renders correctly and no faces appear.
const GLOBAL_STYLE_NOTES =
  'CRITICAL: All text must be in Hebrew (right-to-left). ' +
  'Render every Hebrew name and word with perfect letter shapes — do not invent or distort letters. ' +
  'Do NOT draw human faces; use dramatic silhouettes or shadows of players instead. ' +
  'Design style: dark background, green and gold accents, modern sports aesthetic, square format ready for social media.'

export const buildPrompt = (type, { stats = [], leaders = {}, standings = [], league = null, session = null, players = [] } = {}) => {
  const leagueName = league?.name ?? 'Soccer Zone'

  if (type === 'winning-team') {
    const winner = standings[0]
    const teamName = winner?.teamName ?? 'הקבוצה המנצחת'
    return (
      `צור פוסטר חגיגי ודרמטי לקבוצת השבוע: "${teamName}" בליגת "${leagueName}". ` +
      `הצג בבירור את הכיתוב "🏆 קבוצת השבוע" ואת שם הקבוצה "${teamName}" בצורה בולטת — ודא שהאותיות בעברית מדויקות. ` +
      `קונפטי, ירוק כהה וזהב, טיפוגרפיה מודרנית ועוצמתית. ` +
      `הוסף לוגו "Soccer Zone" בפינה. ` +
      GLOBAL_STYLE_NOTES
    )
  }

  if (type === 'mvp') {
    const mvp = leaders?.mvp
    const name = mvp?.name ?? 'MVP'
    const goals = mvp?.goals ?? 0
    const assists = mvp?.assists ?? 0
    const wins = mvp?.totalGamesWon ?? 0
    return (
      `צור פוסטר MVP דרמטי ועוצמתי לשחקן "${name}" בליגת "${leagueName}". ` +
      `הצג את השם "${name}" בגדול ומדויק — ודא שכל אות בעברית נכתבת נכון. ` +
      `סטטיסטיקות כתגיות מעוצבות: ${goals} שערים ⚽, ${assists} בישולים 🎯, ${wins} ניצחונות. ` +
      `הצג "⭐ MVP" בבולטות. תאורת ספוטלייט זהובה, כוכבים ואפקטי אור. ` +
      `לוגו "Soccer Zone". ` +
      GLOBAL_STYLE_NOTES
    )
  }

  if (type === 'stats-table') {
    const topScorer = [...stats].sort((a, b) => b.goals - a.goals)[0]
    const topAssister = [...stats].sort((a, b) => b.assists - a.assists)[0]
    const mvpName = leaders?.mvp?.name ?? '-'
    const top3 = standings.slice(0, 3).map((r, i) => `${i + 1}. ${r.teamName} (${r.points} נק')`).join(', ')
    return (
      `צור אינפוגרפיקה מעוצבת של סטטיסטיקות עונה לליגת "${leagueName}". ` +
      `חלק 1 — מלך שערים 🥅: "${topScorer?.name ?? '-'}" עם ${topScorer?.goals ?? 0} שערים. ` +
      `חלק 2 — מלך בישולים 🎯: "${topAssister?.name ?? '-'}" עם ${topAssister?.assists ?? 0} בישולים. ` +
      `חלק 3 — MVP 🏆: "${mvpName}". ` +
      (top3 ? `טבלת ניקוד: ${top3}. ` : '') +
      `ודא שכל שם עברי מוצג עם אותיות מדויקות. מדליות 🥇🥈🥉 לדירוגים. ` +
      `לוגו "Soccer Zone" בולט. ` +
      GLOBAL_STYLE_NOTES
    )
  }

  if (type === 'day-results') {
    const date = session?.date ?? ''
    const games = session?.games ?? []
    const top3Standings = standings.slice(0, 3)
      .map((r, i) => `${i + 1}. ${r.teamName} – ${r.points} נק'`).join(', ')
    return (
      `צור פוסטר תוצאות יום משחקים לליגת "${leagueName}"${date ? ` (${date})` : ''}. ` +
      `נערכו ${games.length} משחקים היום. ` +
      (top3Standings ? `טבלת מצב: ${top3Standings}. ` : '') +
      `כותרת ראשית: "תוצאות היום" — ודא שהכיתוב בעברית ברור ומדויק. ` +
      `עיצוב ספורטיבי דינמי ואנרגטי. לוגו "Soccer Zone". ` +
      GLOBAL_STYLE_NOTES
    )
  }

  if (type === 'squads') {
    const teams = session?.teams ?? []
    const teamLines = teams
      .filter((t) => t.players?.length > 0)
      .map((t) => {
        const names = t.players.map((id) => lookupName(id, players)).filter(Boolean).join(', ')
        return `${t.name}: ${names}`
      })
      .join('\n')
    return (
      `צור פוסטר ויזואלי מעוצב של סגלי הקבוצות לליגת "${leagueName}". ` +
      `קבוצות ושחקנים:\n${teamLines || 'ללא שחקנים מוגדרים'}\n` +
      `ודא שכל שם שחקן וקבוצה מוצג בעברית עם אותיות מדויקות ונכונות. ` +
      `כרטיס נפרד לכל קבוצה עם שמה ושמות השחקנים, כל קבוצה עם גוון צבע משלה. ` +
      `לוגו "Soccer Zone" בפינה. ` +
      GLOBAL_STYLE_NOTES
    )
  }

  return `צור תמונה חגיגית לאפליקציית "Soccer Zone". נושא: כדורגל, ירוק וזהב, עיצוב מודרני. ${GLOBAL_STYLE_NOTES}`
}
