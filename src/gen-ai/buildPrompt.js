const lookupName = (id, players) => players.find((p) => p.id === id)?.name ?? ''

export const buildPrompt = (type, { stats = [], leaders = {}, standings = [], league = null, session = null, players = [] } = {}) => {
  const leagueName = league?.name ?? 'Soccer Zone'

  if (type === 'winning-team') {
    const winner = standings[0]
    const teamName = winner?.teamName ?? 'הקבוצה המנצחת'
    return (
      `צור פוסטר חגיגי ודרמטי לקבוצת השבוע: "${teamName}" בליגת "${leagueName}". ` +
      `סגנון: תאורה דרמטית, קונפטי, ירוק כהה וזהב, טיפוגרפיה מודרנית ועוצמתית. ` +
      `הצג בבירור את הכיתוב "🏆 קבוצת השבוע" ואת שם הקבוצה בצורה בולטת. ` +
      `הוסף לוגו "Soccer Zone" בפינה. פורמט ריבועי מוכן לרשתות חברתיות.`
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
      `סטטיסטיקות: ${goals} שערים ⚽, ${assists} בישולים 🎯, ${wins} ניצחונות. ` +
      `סגנון: תאורת ספוטלייט זהובה, כוכבים ואפקטי אור, רקע כהה, טקסט מודגש. ` +
      `הצג את הכיתוב "⭐ MVP" בבולטות, שם השחקן בגדול, והסטטיסטיקות כתגיות מעוצבות. ` +
      `לוגו "Soccer Zone". עיצוב ספורטיבי מודרני, פורמט ריבועי.`
    )
  }

  if (type === 'stats-table') {
    const topScorer = [...stats].sort((a, b) => b.goals - a.goals)[0]
    const topAssister = [...stats].sort((a, b) => b.assists - a.assists)[0]
    const mvpName = leaders?.mvp?.name ?? '-'
    const top3 = standings.slice(0, 3).map((r, i) => `${i + 1}. ${r.teamName} (${r.points} נק')`).join(', ')
    return (
      `צור אינפוגרפיקה מעוצבת של סטטיסטיקות עונה לליגת "${leagueName}". ` +
      `מלך שערים: ${topScorer?.name ?? '-'} עם ${topScorer?.goals ?? 0} שערים. ` +
      `מלך בישולים: ${topAssister?.name ?? '-'} עם ${topAssister?.assists ?? 0} בישולים. ` +
      `MVP: ${mvpName}. ` +
      (top3 ? `טבלת ניקוד: ${top3}. ` : '') +
      `סגנון: רקע כהה, ירוק וזהב מבריקים, עיצוב נקי ומודרני. ` +
      `חלקים: כובשים 🥅, מבשלים 🎯, MVP 🏆. מדליות 🥇🥈🥉 לדירוגים. ` +
      `לוגו "Soccer Zone" בולט. פורמט ריבועי.`
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
      `סגנון: עיצוב ספורטיבי דינמי ואנרגטי, רקע ירוק כהה, זהב ולבן. ` +
      `כותרת ראשית: "תוצאות היום" עם טבלת מצב ותוצאות. ` +
      `לוגו "Soccer Zone". פורמט ריבועי מוכן לרשתות חברתיות.`
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
      `סגנון: עיצוב ספורטיבי מודרני, רקע כהה, כרטיס נפרד לכל קבוצה עם שמה ושמות השחקנים. ` +
      `כל קבוצה עם גוון צבע משלה, גופן ברור ונקי. ` +
      `לוגו "Soccer Zone" בפינה. פורמט ריבועי מוכן לרשתות חברתיות.`
    )
  }

  return `צור תמונה חגיגית לאפליקציית "Soccer Zone". נושא: כדורגל, ירוק וזהב, עיצוב מודרני.`
}
