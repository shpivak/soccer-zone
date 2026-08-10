// Boost studio branches — each session belongs to exactly one physical location.
export const BOOST_BRANCHES = [
  {
    id: '15511',
    label: 'שרון / בית ברל',
    matchSubstrings: ['בית ברל', 'בית-ברל', 'ביתברל'],
    matchTokens: ['שרון'],
  },
  {
    id: '15513',
    label: 'תל אביב',
    matchSubstrings: ['תל אביב', 'תל-אביב'],
    matchTokens: ['ת"א', 'ת״א', "ת'א"],
  },
  {
    id: '16370',
    label: 'באר שבע',
    matchSubstrings: ['באר שבע', 'באר-שבע'],
    matchTokens: ['ב"ש', 'ב״ש'],
  },
]

export const DEFAULT_BOOST_BRANCH_ID = BOOST_BRANCHES[0].id

// Simple keyword guess from free text (e.g. league name) — no fuzzy matching, just
// substring/token checks against the Hebrew names/abbreviations for each branch.
export const guessBoostBranchId = (text) => {
  if (!text) return null
  const tokens = text.split(/\s+/)
  for (const branch of BOOST_BRANCHES) {
    if (branch.matchSubstrings.some((s) => text.includes(s))) return branch.id
    if (branch.matchTokens.some((t) => tokens.includes(t))) return branch.id
  }
  return null
}
