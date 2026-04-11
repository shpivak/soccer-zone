/**
 * Balanced team generator.
 *
 * Each player has:
 *   isOffense (bool), isDefense (bool)  → role: attack-only | defense-only | versatile
 *   rank ('A' | 'B' | 'C' | undefined)  → strength: A=3, B=2, C=1
 *
 * Goals:
 *   - Distribute players evenly across teams
 *   - Prefer 1 attack-only + 1 defense-only per team (soft)
 *   - Pair A players with C players on the same team where possible
 *   - Keep overall team strength roughly equal
 *   - Randomise so each call produces a different result
 */

const RANK_SCORE = { A: 3, B: 2, C: 1 }
const rankScore = (player) => RANK_SCORE[player.rank ?? 'B'] ?? 2

const shuffle = (arr) => {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/**
 * Pick the team index that should receive the next player.
 * Priority: fewest players → lowest score → random among ties.
 * A ±1 score tolerance prevents over-precision and adds variety.
 */
const pickTarget = (teamIndices, assignments) => {
  const size = (i) => assignments[i].length
  const score = (i) => assignments[i].reduce((s, p) => s + rankScore(p), 0)

  const sorted = [...teamIndices].sort((a, b) => {
    const sd = size(a) - size(b)
    return sd !== 0 ? sd : score(a) - score(b)
  })

  const minSz = size(sorted[0])
  const minSc = score(sorted[0])
  const tier = sorted.filter(
    (i) => size(i) === minSz && score(i) <= minSc + 1,
  )
  return tier[Math.floor(Math.random() * tier.length)]
}

export const generateBalancedTeams = (players, teams) => {
  if (!players.length || !teams.length) return teams

  const numTeams = teams.length
  const totalPlayers = players.length
  const maxSize = Math.ceil(totalPlayers / numTeams)

  // ── Classify by role ──────────────────────────────────────────────
  const attackOnly = []
  const defenseOnly = []
  const versatile = []
  for (const p of players) {
    if (p.isOffense && !p.isDefense) attackOnly.push(p)
    else if (!p.isOffense && p.isDefense) defenseOnly.push(p)
    else versatile.push(p) // both flags set, or neither
  }

  // Shuffle within each role group for randomness
  const sAttack = shuffle(attackOnly)
  const sDefense = shuffle(defenseOnly)
  const sVersatile = shuffle(versatile)

  // ── Initialise assignment buckets ─────────────────────────────────
  const assignments = Array.from({ length: numTeams }, () => [])
  const allIdx = Array.from({ length: numTeams }, (_, i) => i)
  const eligible = () => allIdx.filter((i) => assignments[i].length < maxSize)

  // ── Phase 1: seed one attacker per team (soft requirement) ────────
  // Random team order so no team has a systematic advantage
  const attackQueue = [...sAttack]
  for (const t of shuffle([...allIdx])) {
    if (!attackQueue.length) break
    assignments[t].push(attackQueue.shift())
  }

  // ── Phase 2: seed one defender per team (soft requirement) ────────
  const defenseQueue = [...sDefense]
  for (const t of shuffle([...allIdx])) {
    if (!defenseQueue.length) break
    assignments[t].push(defenseQueue.shift())
  }

  // ── Phase 3: rank-balanced fill ───────────────────────────────────
  // Pool remaining players (leftover attackers/defenders + all versatile).
  // Sort A → B → C (within each tier the order is already shuffled).
  // Assigning strongest players first to the *weakest* teams means that
  // by the time C players are handed out, the A-teams are the strongest
  // → they receive C players, achieving the desired A+C pairing.
  const rankOrder = { A: 0, B: 1, C: 2 }
  const remaining = [...attackQueue, ...defenseQueue, ...sVersatile]
  remaining.sort(
    (a, b) => (rankOrder[a.rank ?? 'B'] ?? 1) - (rankOrder[b.rank ?? 'B'] ?? 1),
  )

  for (const player of remaining) {
    const targets = eligible()
    if (!targets.length) break
    assignments[pickTarget(targets, assignments)].push(player)
  }

  // ── Map back to original team objects (preserve id / name / color) ─
  return teams.map((team, i) => ({
    ...team,
    players: assignments[i].map((p) => p.id),
  }))
}
