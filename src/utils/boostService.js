import { SUPABASE_ANON_KEY, SUPABASE_URL } from './storageConfig'

export const BOOST_CLASS_ID = import.meta.env.VITE_BOOST_CLASS_ID?.trim() ?? ''

async function callEdgeFunction(body) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Supabase not configured')
  const res = await fetch(`${SUPABASE_URL}/functions/v1/boost-players`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

export async function loadBoostClasses({ todayOnly = false, branchId } = {}) {
  return callEdgeFunction({ action: 'classes', scope: todayOnly ? 'today' : 'week', branchId })
  // returns { classes: [{id, title, start, end, members, coachName}], startDate, endDate, branchId, count }
}

export async function loadBoostPlayers(classId = BOOST_CLASS_ID) {
  return callEdgeFunction({ classId })
  // returns { players: [{clientId, name}], classId, count }
}
