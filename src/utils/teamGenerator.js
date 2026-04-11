/**
 * Balanced team generator.
 * See docs/team-generator-algorithm.md for the full design rationale.
 *
 * Strength model: A=3, B=2, C=1  →  A+C = 4 = B+B
 *
 * Steps:
 *  1. Distribute A players evenly via round-robin (no team gets 2 A's while another gets 0)
 *  2. Offset each A with a C on the same team  (restores parity: A+C ≈ B+B)
 *  3. Soft role seeding — give teams missing an attacker/defender one from the B/leftover-C pool
 *  4. Fill remaining slots (B + leftovers) using weakest-team-first
 */

const RANK_SCORE = { A: 3, B: 2, C: 1 }
const rankScore = (player) => RANK_SCORE[player.rank ?? 'B'] ?? 2
const teamScore = (bucket) => bucket.reduce((s, p) => s + rankScore(p), 0)

const shuffle = (arr) => {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/**
 * Among eligible team indices, pick the one with:
 *   1. fewest players  (primary)
 *   2. lowest score    (secondary)
 *   3. random among ties within ±1 score tolerance
 */
const pickWeakest = (teamIndices, assignments) => {
  const size = (i) => assignments[i].length
  const score = (i) => teamScore(assignments[i])

  const sorted = [...teamIndices].sort((a, b) => {
    const sd = size(a) - size(b)
    return sd !== 0 ? sd : score(a) - score(b)
  })

  const minSz = size(sorted[0])
  const minSc = score(sorted[0])
  const tier = sorted.filter((i) => size(i) === minSz && score(i) <= minSc + 1)
  return tier[Math.floor(Math.random() * tier.length)]
}

/** Pull the first player of a given role from a mutable pool array. */
const pullByRole = (pool, wantAttack) => {
  const idx = pool.findIndex((p) =>
    wantAttack ? (p.isOffense && !p.isDefense) : (!p.isOffense && p.isDefense),
  )
  if (idx === -1) return null
  return pool.splice(idx, 1)[0]
}

export const generateBalancedTeams = (players, teams) => {
  if (!players.length || !teams.length) return teams

  const N = teams.length
  const maxSize = Math.ceil(players.length / N)

  // ── Pools by rank (each shuffled for randomness) ──────────────────
  const poolA = shuffle(players.filter((p) => (p.rank ?? 'B') === 'A'))
  const poolB = shuffle(players.filter((p) => (p.rank ?? 'B') === 'B'))
  const poolC = shuffle(players.filter((p) => (p.rank ?? 'B') === 'C'))

  const assignments = Array.from({ length: N }, () => [])
  const allIdx = Array.from({ length: N }, (_, i) => i)
  const eligible = () => allIdx.filter((i) => assignments[i].length < maxSize)

  // ── Step 1: distribute A players evenly via round-robin ───────────
  // Shuffle the team order so which teams get the "extra" A is random.
  const teamOrder = shuffle([...allIdx])
  poolA.forEach((player, i) => {
    assignments[teamOrder[i % N]].push(player)
  })

  // ── Step 2: offset each A with a C on the same team ──────────────
  // Teams with the most A players (highest score) go first.
  const byScoreDesc = [...allIdx].sort((a, b) => teamScore(assignments[b]) - teamScore(assignments[a]))
  for (const t of byScoreDesc) {
    const aCount = assignments[t].filter((p) => (p.rank ?? 'B') === 'A').length
    for (let k = 0; k < aCount; k++) {
      if (!poolC.length) break
      assignments[t].push(poolC.shift())
    }
  }

  // ── Step 3: soft role seeding from B pool (and leftover C) ────────
  // Build a mutable fill pool from B + remaining C for role hunting.
  // We prioritise B so we don't burn C players that might balance things later.
  const fillPool = [...poolB, ...poolC] // poolC is now leftover only
  shuffle(fillPool)

  const hasAttacker = (t) => assignments[t].some((p) => p.isOffense && !p.isDefense)
  const hasDefender = (t) => assignments[t].some((p) => !p.isOffense && p.isDefense)

  for (const t of shuffle([...allIdx])) {
    if (assignments[t].length >= maxSize) continue
    if (!hasAttacker(t)) {
      const p = pullByRole(fillPool, true)
      if (p) assignments[t].push(p)
    }
  }
  for (const t of shuffle([...allIdx])) {
    if (assignments[t].length >= maxSize) continue
    if (!hasDefender(t)) {
      const p = pullByRole(fillPool, false)
      if (p) assignments[t].push(p)
    }
  }

  // ── Step 4: fill remaining slots (weakest team first) ─────────────
  for (const player of fillPool) {
    const targets = eligible()
    if (!targets.length) break
    assignments[pickWeakest(targets, assignments)].push(player)
  }

  // ── Map back to original team objects (preserve id / name / color) ─
  return teams.map((team, i) => ({
    ...team,
    players: assignments[i].map((p) => p.id),
  }))
}
