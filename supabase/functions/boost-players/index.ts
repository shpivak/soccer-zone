import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const BOOST_BASE = 'https://login.boostapp.co.il'
const BOOST_COMPANY_NUM = '601208'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })

async function boostLogin(): Promise<{ authCookie: string } | { error: string }> {
  const username = Deno.env.get('BOOST_USERNAME')
  const password = Deno.env.get('BOOST_PASSWORD')
  if (!username || !password) return { error: 'BOOST_USERNAME / BOOST_PASSWORD not configured' }

  const loginPageRes = await fetch(`${BOOST_BASE}/`, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  const sessionCookie = loginPageRes.headers.get('set-cookie')?.match(/247SOFT_session=([^;]+)/)?.[1]
  const loginHtml = await loginPageRes.text()
  const csrf = loginHtml.match(/name="csrf-token"\s+content="([^"]+)"/)?.[1]
  if (!sessionCookie || !csrf) return { error: 'Failed to initialize Boost session' }

  const loginRes = await fetch(`${BOOST_BASE}/office/ajax/login/login.php`, {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest',
      'X-CSRF-TOKEN': csrf,
      Cookie: `247SOFT_session=${sessionCookie}`,
      Referer: `${BOOST_BASE}/`,
    },
    body: new URLSearchParams({ username, password, action: 'loginByEmail' }).toString(),
  })
  const authCookie =
    loginRes.headers.get('set-cookie')?.match(/247SOFT_session=([^;]+)/)?.[1] ?? sessionCookie
  const loginData = await loginRes.json()
  if (!loginData.success) return { error: `Boost login failed: ${loginData.message}` }
  return { authCookie }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const body = await req.json().catch(() => ({}))

    // action=classes → return today's training sessions as a picker list
    if (body.action === 'classes') {
      const loginResult = await boostLogin()
      if ('error' in loginResult) return json({ error: loginResult.error }, 'authCookie' in loginResult ? 401 : 500)
      const { authCookie } = loginResult as { authCookie: string }

      // scope='today' → just today; default → ±BOOST_DAYS_RANGE days (default 3)
      const now = new Date()
      const today = now.toISOString().slice(0, 10)
      let startDate: string, endDate: string
      if (body.scope === 'today') {
        startDate = today; endDate = today
      } else {
        const days = parseInt(Deno.env.get('BOOST_DAYS_RANGE') ?? '3', 10)
        const start = new Date(now); start.setDate(now.getDate() - days)
        const end = new Date(now); end.setDate(now.getDate() + days)
        startDate = start.toISOString().slice(0, 10)
        endDate = end.toISOString().slice(0, 10)
      }
      const params = new URLSearchParams({
        action: 'getEvents',
        startDate,
        endDate,
        companyNum: BOOST_COMPANY_NUM,
      })
      const calRes = await fetch(`${BOOST_BASE}/office/ajax/Calendar.php`, {
        method: 'POST',
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest',
          Cookie: `247SOFT_session=${authCookie}; screen_width=1440`,
          Referer: `${BOOST_BASE}/office/calendar.php`,
        },
        body: params.toString(),
      })
      const calData = await calRes.json()
      if (!calData.success) return json({ error: calData.message ?? 'Calendar fetch failed' }, 502)

      const classes = ((calData.data?.events ?? []) as Array<{
        id: number; title: string; start: string; end: string
        type: string; members: string; coachName: string
      }>)
        .filter((e) => e.type === '3')
        .sort((a, b) => a.start.localeCompare(b.start))
        .map((e) => ({
          id: String(e.id),
          title: e.title.trim(),
          start: e.start,
          end: e.end,
          members: Number(e.members),
          coachName: e.coachName,
        }))

      return json({ classes, startDate, endDate, count: classes.length })
    }

    // default: fetch player attendance for a specific classId
    const classId: string = body.classId ?? Deno.env.get('BOOST_CLASS_ID') ?? ''
    if (!classId) return json({ error: 'classId required (pass in body or set BOOST_CLASS_ID secret)' }, 400)

    const loginResult = await boostLogin()
    if ('error' in loginResult) return json({ error: loginResult.error }, 500)
    const { authCookie } = loginResult as { authCookie: string }

    const classRes = await fetch(`${BOOST_BASE}/office/characteristics-popup.php?id=${classId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Accept: '*/*',
        'X-Requested-With': 'XMLHttpRequest',
        Cookie: `247SOFT_session=${authCookie}`,
        Referer: `${BOOST_BASE}/office/calendar.php`,
      },
    })
    const classData = await classRes.json()
    const conclusionTab = classData?.js_class_data?.conclusionTab
    if (!conclusionTab) return json({ error: 'No attendance data — classId may be invalid' }, 404)

    let players: Array<{ clientId: string; name: string }>

    if ((conclusionTab.present ?? []).length > 0) {
      // Past class: use actual attendees
      players = conclusionTab.present.map(
        (p: { clientId: string; firstName: string; lastName: string }) => ({
          clientId: p.clientId,
          name: `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim(),
        }),
      )
    } else {
      // Future/in-progress class: parse registered players from popup HTML
      const html: string = classData?.js_char_popup_content ?? ''
      const re = /data-clientid="(\d+)"[^>]*data-name=\s*"([^"]+)"/g
      players = []
      let m: RegExpExecArray | null
      while ((m = re.exec(html)) !== null) {
        players.push({ clientId: m[1], name: m[2].trim() })
      }
    }

    return json({ players, classId, count: players.length, source: (conclusionTab.present ?? []).length > 0 ? 'attended' : 'registered' })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})
