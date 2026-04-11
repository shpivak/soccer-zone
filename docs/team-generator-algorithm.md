# Team Generator Algorithm

## Strength Model

| Pair | Score |
|------|-------|
| A + C | 3 + 1 = **4** |
| B + B | 2 + 2 = **4** |
| A + B | 3 + 2 = **5** → needs a C somewhere else |

Key principle: **an A player on a team must be offset by a C player on the same team** to keep strength balanced across teams.

---

## Input

- `players[]` — each player has `rank` (A/B/C, default B) and role flags (`isOffense`, `isDefense`)
- `teams[]` — N existing team slots (we keep their names/colors, just refill `players`)

---

## Pseudo-Algorithm

### Setup

```
poolA = shuffle(players where rank == 'A')
poolB = shuffle(players where rank == 'B' or rank undefined)
poolC = shuffle(players where rank == 'C')

attackOnly  = players where isOffense && !isDefense
defenseOnly = players where !isOffense && isDefense
versatile   = everyone else (both flags or neither)

assignments = N empty buckets
```

---

### Step 1 — Distribute A players evenly (round-robin)

```
Shuffle team order (random permutation of [0..N-1]).
For i in 0..len(poolA)-1:
  Assign poolA[i] → assignments[teamOrder[i % N]]
```

Result: each team gets `⌊|A|/N⌋` A players; first `|A| mod N` teams get one extra.  
No team gets 2 A's while another gets 0 — unless `|A| > N`, in which case it's unavoidable but still as fair as possible.

---

### Step 2 — Offset each A with a C (A + C ≈ B + B)

```
Sort teams by currentScore DESC (most A-heavy teams first).
For each team in this order:
  For each A player this team has:
    If poolC is not empty:
      Assign one C player from poolC → this team.
```

Result: a team with 2 A's gets 2 C's (net score: +4+4 from pairs).  
A team with 0 A's gets no C's (may be all-B, which is valid).  
C players that exceed the A count are leftover for step 4.

---

### Step 3 — Role seeding (soft, best-effort)

```
For each team that has no attack-only player yet:
  Search poolB + leftover poolC (in that order) for an attackOnly player.
  If found: move that player to this team (remove from pool).

For each team that has no defense-only player yet:
  Same, searching for a defenseOnly player.
```

This is a soft pass — skip silently if no suitable player exists.  
Role seeding is done from B (same rank) and leftover C so it doesn't disturb the A/C balance from step 2.

---

### Step 4 — Fill remaining slots

```
remaining = leftover C + poolB + versatile  (all shuffled together)

For each player in remaining (in shuffled order):
  eligible = teams where size < maxSize
  target = team in eligible with:
    1. fewest players  (primary)
    2. lowest score    (secondary)
    3. random among ties
  Assign player → target.
```

`maxSize = ⌈totalPlayers / N⌉`

---

### Step 5 — Output

```
Return teams[] with updated players arrays (preserve id, name, color).
```

---

## Open Questions / Tweaks

- **Step 2**: Should we strictly give 1 C per A, or allow partial (1 C for 2 A's)?  
- **Step 3**: Should role seeding happen before rank distribution (guarantee roles first) or after (guarantee rank balance first)?  
- **Leftover C**: When there are more C players than A players, leftover C goes into the fill pool. Is that OK, or should we try to put leftover C's on the strongest B-teams?  
- **Score tolerance**: Should "lowest score" have a ±1 tolerance to add more randomness, or be exact?
