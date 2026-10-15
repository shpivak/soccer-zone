import { getSessionDisplayName, getTeamDisplayName, LEAGUE_TYPES } from './leagueUtils'

const getPlayerName = (playerId, players) => players.find((p) => p.id === playerId)?.name ?? ''
const appendShareLink = (message) => message

const colorEmoji = {
  black: '⚫',
  yellow: '🟡',
  pink: '🟣',
  green: '🟢',
  orange: '🟠',
  blue: '🔵',
  white: '⚪',
  gray: '⬜',
}

const rankEmoji = (rank) => {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return `${rank}.`
}

// Takes a sorted array, groups ties, returns ranked lines up to maxPlaces
const getRankedLines = (sorted, getValue, getName, suffix, maxPlaces = 5) => {
  const lines = []
  let rank = 1
  let i = 0
  while (i < sorted.length && lines.length < maxPlaces) {
    const val = getValue(sorted[i])
    if (val === 0) break
    const group = []
    while (i < sorted.length && getValue(sorted[i]) === val) {
      group.push(getName(sorted[i]))
      i++
    }
    lines.push(`${rankEmoji(rank)} ${group.join(' / ')} (${val} ${suffix})`)
    rank += group.length
  }
  return lines.join('\n')
}

const getTournamentRankedStats = (games, players) => {
  const goalCount = {}
  const assistCount = {}
  for (const game of games) {
    for (const event of game.events ?? []) {
      if (event.scorer) goalCount[event.scorer] = (goalCount[event.scorer] ?? 0) + 1
      if (event.assister) assistCount[event.assister] = (assistCount[event.assister] ?? 0) + 1
    }
  }

  const toSorted = (countMap) =>
    Object.entries(countMap)
      .map(([id, count]) => ({ id, count, name: getPlayerName(id, players) }))
      .sort((a, b) => b.count - a.count)

  return { scorers: toSorted(goalCount), assisters: toSorted(assistCount) }
}

export const buildLeagueShareUrl = (leagueId, tournamentId = '') => {
  if (typeof window === 'undefined' || !leagueId) return ''
  const url = new URL(window.location.href)
  url.searchParams.set('league', leagueId)
  if (tournamentId) {
    url.searchParams.set('tournament', tournamentId)
  } else {
    url.searchParams.delete('tournament')
  }
  return url.toString()
}

export const generateTeamShareMessage = (tournament, players, leagueName, league, shareUrl = '') => {
  const assignedTeams = (tournament?.teams ?? []).filter((team) => Array.isArray(team.players) && team.players.length > 0)
  let msg = `👥 *${leagueName}*\n${getSessionDisplayName(tournament, league)}`

  const teamLines = assignedTeams
    .map((team) => {
      const playerLines = team.players
        .map((playerId) => getPlayerName(playerId, players))
        .filter(Boolean)
        .map((name) => `- ${name}`)
        .join('\n')

      const displayName = getTeamDisplayName(team)
      // Regular league: teams have custom names — show as-is; tournament/friendly: prefix with color emoji
      const teamHeader =
        league?.type === LEAGUE_TYPES.regular
          ? displayName
          : `${colorEmoji[team.color] ?? '🟢'} ${displayName}`
      return `${teamHeader}\n${playerLines}`
    })
    .join('\n\n')

  msg += `\n\n${teamLines || 'אין קבוצות עם שחקנים לשיתוף'}`
  return appendShareLink(msg, shareUrl)
}

export const generateDayShareMessage = (
  tournament,
  teams,
  players,
  leagueName,
  standings = [],
  { includeResults = true, shareUrl = '', mvp = null } = {},
) => {
  const date = tournament.date ?? ''
  const games = tournament.games ?? []

  const getTeamName = (teamId) => getTeamDisplayName(teams.find((t) => t.id === teamId))

  const { scorers, assisters } = getTournamentRankedStats(games, players)

  const scorerLines = getRankedLines(scorers, (e) => e.count, (e) => e.name, 'שערים')
  const assisterLines = getRankedLines(assisters, (e) => e.count, (e) => e.name, 'בישולים')

  let msg = `⚽ *${leagueName}*\n📅 ${date}`

  if (includeResults) {
    const resultsLines = games
      .filter((game) => game.played !== false)
      .map((game) => {
        const line = `${getTeamName(game.teamA)} ${game.score.a} – ${game.score.b} ${getTeamName(game.teamB)}`
        return game.description ? `${line}\n   📝 ${game.description}` : line
      })
      .join('\n')
    msg += `\n\n📋 תוצאות:\n${resultsLines || 'אין משחקים'}`
  }

  if (standings.length > 0) {
    msg += `\n\n📊 טבלת סיום:`
    standings.forEach((row, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`
      msg += `\n${medal} ${row.teamName} – ${row.points} נק׳`
    })
  }

  if (scorerLines) msg += `\n\n🥅 כובשים:\n${scorerLines}`
  if (assisterLines) msg += `\n\n🎯 מבשלים:\n${assisterLines}`
  if (mvp) msg += `\n\n🏆 MVP: *${mvp.name}*`

  return appendShareLink(msg, shareUrl)
}

export const generateOverallShareMessage = (stats, leaders, standings, leagueName, shareUrl = '') => {
  let msg = `🏆 *${leagueName} – סיכום כללי*`

  // Teams standings — only when passed (regular leagues)
  if (standings.length > 0) {
    msg += `\n\n📊 טבלת ניקוד:`
    standings.forEach((row, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`
      msg += `\n${medal} ${row.teamName} – ${row.points} נק׳`
    })
  }

  // Scorers 1-5
  const sortedScorers = [...stats].sort((a, b) => b.goals - a.goals || b.assists - a.assists)
  const scorerLines = getRankedLines(sortedScorers, (p) => p.goals, (p) => p.name, 'שערים')
  if (scorerLines) msg += `\n\n⚽ מלך שערים:\n${scorerLines}`

  // Assisters 1-5
  const sortedAssisters = [...stats].sort((a, b) => b.assists - a.assists || b.goals - a.goals)
  const assisterLines = getRankedLines(sortedAssisters, (p) => p.assists, (p) => p.name, 'בישולים')
  if (assisterLines) msg += `\n\n🎯 מלך בישולים:\n${assisterLines}`

  // MVP
  if (leaders?.mvp) msg += `\n\n🏆 MVP: *${leaders.mvp.name}*`

  return appendShareLink(msg, shareUrl)
}

export const generateCombinedShareMessage = (dayMsg, overallMsg) => `${dayMsg}\n\n───────────────\n\n${overallMsg}`

export const shareViaWhatsApp = (message) => {
  const encoded = encodeURIComponent(message)
  if (navigator.share) {
    navigator.share({ text: message }).catch(() => {
      window.open(`https://wa.me/?text=${encoded}`, '_blank')
    })
  } else {
    window.open(`https://wa.me/?text=${encoded}`, '_blank')
  }
}

/** Single-game result message sent to the coaches group right after a game is saved. */
export const generateGameShareMessage = (game, teams, players, leagueName, sessionName = '', standings = []) => {
  if (!game) return ''
  const getTeamName = (teamId) => getTeamDisplayName(teams.find((t) => t.id === teamId))
  let msg = `⚽ *${leagueName}*`
  if (sessionName) msg += `\n${sessionName}`
  msg += `\n\n${getTeamName(game.teamA)} ${game.score.a} – ${game.score.b} ${getTeamName(game.teamB)}`

  const goalLines = (game.events ?? [])
    .filter((event) => event.type !== 'card' && event.scorer)
    .map((event) => {
      const assister = event.assister ? ` (בישול: ${getPlayerName(event.assister, players)})` : ''
      return `⚽ ${getPlayerName(event.scorer, players)}${assister}`
    })
  if (goalLines.length > 0) msg += `\n\n${goalLines.join('\n')}`
  if (game.description) msg += `\n📝 ${game.description}`

  if (standings.length > 0) {
    msg += `\n\n📊 טבלה:`
    standings.forEach((row, i) => {
      msg += `\n${rankEmoji(i + 1)} ${row.teamName} – ${row.points} נק׳`
    })
  }
  return msg
}

/** Center-crops an image file to a portrait (3:4) JPEG file, so landscape shots still come out "לאורך". */
export const cropToPortrait = (file, { maxHeight = 1600 } = {}) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const targetRatio = 3 / 4
      let sw = img.naturalWidth
      let sh = img.naturalHeight
      if (sw / sh > targetRatio) sw = Math.round(sh * targetRatio)
      else sh = Math.round(sw / targetRatio)
      const sx = Math.round((img.naturalWidth - sw) / 2)
      const sy = Math.round((img.naturalHeight - sh) / 2)
      const outH = Math.min(sh, maxHeight)
      const outW = Math.round(outH * targetRatio)
      const canvas = document.createElement('canvas')
      canvas.width = outW
      canvas.height = outH
      canvas.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH)
      URL.revokeObjectURL(url)
      canvas.toBlob(
        (blob) => (blob ? resolve(new File([blob], `game-${Date.now()}.jpg`, { type: 'image/jpeg' })) : reject(new Error('crop failed'))),
        'image/jpeg',
        0.85,
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('image load failed'))
    }
    img.src = url
  })

const toPngBlob = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      canvas.getContext('2d').drawImage(img, 0, 0)
      URL.revokeObjectURL(url)
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('png failed'))), 'image/png')
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('image load failed'))
    }
    img.src = url
  })

/** Copies plain text to the clipboard. Returns true on success. */
export const copyTextToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/**
 * Copies the photo (as PNG — the only image type browsers allow on the clipboard) to the clipboard,
 * with the text alongside it, so it can be pasted straight into WhatsApp (Web/Desktop). Returns true on success.
 */
export const copyImageToClipboard = async (file, text = '') => {
  if (!file || typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) return false
  try {
    const items = { 'image/png': toPngBlob(file) }
    if (text) items['text/plain'] = new Blob([text], { type: 'text/plain' })
    await navigator.clipboard.write([new ClipboardItem(items)])
    return true
  } catch {
    return false
  }
}

/**
 * Sends photo + text to WhatsApp through the device share sheet (the coach picks the group).
 * Where file sharing isn't available (most desktops), the photo is copied to the clipboard for pasting instead.
 * Returns 'shared' | 'image-copied' | 'photo-downloaded' | 'text-only' | 'cancelled'.
 */
export const sharePhotoToWhatsApp = async (file, message) => {
  const data = file ? { files: [file], text: message } : { text: message }
  if (navigator.share && (!file || navigator.canShare?.(data))) {
    // Copy the text too: some WhatsApp versions drop the caption when an image is attached
    await copyTextToClipboard(message)
    try {
      await navigator.share(data)
      return 'shared'
    } catch (error) {
      if (error?.name === 'AbortError') return 'cancelled'
    }
  }
  if (file && (await copyImageToClipboard(file, message))) return 'image-copied'
  await copyTextToClipboard(message)
  if (file) {
    const link = document.createElement('a')
    link.href = URL.createObjectURL(file)
    link.download = file.name
    link.click()
    setTimeout(() => URL.revokeObjectURL(link.href), 1000)
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank')
  return file ? 'photo-downloaded' : 'text-only'
}

/**
 * Draws the result text onto the bottom of the photo, so the result travels with the image even when
 * WhatsApp drops the caption (common on iPhone when sharing an image with text). Returns a new JPEG file.
 */
export const overlayTextOnPhoto = (file, text) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const w = img.naturalWidth
      const h = img.naturalHeight
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(url)

      const lines = text.replace(/\*/g, '').split('\n')
      while (lines.length && !lines[lines.length - 1].trim()) lines.pop()
      const pad = Math.round(w * 0.05)
      // Shrink the font until the block fits in the bottom 65% of the photo
      let fontSize = Math.round(w / 18)
      const fits = () => {
        ctx.font = `bold ${fontSize}px sans-serif`
        const widest = Math.max(...lines.map((line) => ctx.measureText(line).width))
        return widest <= w - pad * 2 && lines.length * fontSize * 1.3 + pad * 2 <= h * 0.65
      }
      while (fontSize > 10 && !fits()) fontSize -= 1
      const lineHeight = Math.round(fontSize * 1.3)
      const blockHeight = lines.length * lineHeight + pad * 2

      const gradient = ctx.createLinearGradient(0, h - blockHeight - pad * 2, 0, h)
      gradient.addColorStop(0, 'rgba(0,0,0,0)')
      gradient.addColorStop(0.25, 'rgba(0,0,0,0.7)')
      gradient.addColorStop(1, 'rgba(0,0,0,0.85)')
      ctx.fillStyle = gradient
      ctx.fillRect(0, h - blockHeight - pad * 2, w, blockHeight + pad * 2)

      ctx.fillStyle = '#fff'
      ctx.direction = 'rtl'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'top'
      ctx.font = `bold ${fontSize}px sans-serif`
      lines.forEach((line, i) => ctx.fillText(line, w - pad, h - blockHeight + pad + i * lineHeight))

      canvas.toBlob(
        (blob) => (blob ? resolve(new File([blob], file.name, { type: 'image/jpeg' })) : reject(new Error('overlay failed'))),
        'image/jpeg',
        0.88,
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('image load failed'))
    }
    img.src = url
  })
