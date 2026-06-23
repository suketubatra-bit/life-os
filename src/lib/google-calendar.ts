import { google } from 'googleapis'
import { getDb } from './db'

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/gmail.send',
]

export function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback'
  )
}

export function getAuthUrl(): string {
  const auth = getOAuth2Client()
  return auth.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  })
}

export async function saveTokens(tokens: { access_token?: string | null; refresh_token?: string | null; expiry_date?: number | null }) {
  const db = await getDb()
  await db.execute({
    sql: `INSERT INTO calendar_tokens (id, access_token, refresh_token, expiry_date)
      VALUES (1, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        access_token = excluded.access_token,
        refresh_token = COALESCE(excluded.refresh_token, refresh_token),
        expiry_date = excluded.expiry_date`,
    args: [tokens.access_token ?? null, tokens.refresh_token ?? null, tokens.expiry_date ?? null],
  })
}

export async function loadTokens() {
  const db = await getDb()
  const result = await db.execute('SELECT * FROM calendar_tokens WHERE id = 1')
  return result.rows[0] as unknown as {
    access_token: string | null
    refresh_token: string | null
    expiry_date: number | null
  } | undefined
}

export async function getAuthedClient() {
  const tokens = await loadTokens()
  if (!tokens?.refresh_token) throw new Error('NOT_CONNECTED')

  const auth = getOAuth2Client()
  auth.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date,
  })

  auth.on('tokens', (newTokens) => {
    saveTokens(newTokens).catch(() => {})
  })

  return auth
}

export async function createCalendarEvent(params: {
  summary: string
  description?: string
  startDateTime: string
  endDateTime: string
  recurrence?: string[]
  colorId?: string
}) {
  const auth = await getAuthedClient()
  const calendar = google.calendar({ version: 'v3', auth })

  const res = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: {
      summary: params.summary,
      description: params.description,
      start: { dateTime: params.startDateTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      end: { dateTime: params.endDateTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      recurrence: params.recurrence,
      colorId: params.colorId,
    },
  })

  return res.data
}

export async function createDeadlineEvent(goalTitle: string, deadline: string) {
  const auth = await getAuthedClient()
  const calendar = google.calendar({ version: 'v3', auth })

  const deadlineDate = new Date(deadline)
  const reminderDate = new Date(deadlineDate)
  reminderDate.setDate(reminderDate.getDate() - 3)

  await calendar.events.insert({
    calendarId: 'primary',
    requestBody: {
      summary: `⏰ 3 days left: ${goalTitle}`,
      description: `Deadline reminder for your goal: "${goalTitle}". Final deadline: ${deadlineDate.toLocaleDateString()}`,
      start: { date: reminderDate.toISOString().split('T')[0] },
      end: { date: reminderDate.toISOString().split('T')[0] },
      colorId: '11', // tomato red
      reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 480 }] },
    },
  })

  await calendar.events.insert({
    calendarId: 'primary',
    requestBody: {
      summary: `🎯 DEADLINE: ${goalTitle}`,
      description: `Final deadline for your goal: "${goalTitle}"`,
      start: { date: deadlineDate.toISOString().split('T')[0] },
      end: { date: deadlineDate.toISOString().split('T')[0] },
      colorId: '4', // flamingo
      reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 480 }] },
    },
  })
}

export async function buildIdealWeek(goals: Array<{ title: string; sphere_id: string; energizer: string | null; energy_level: string | null; ideal_week_slot: string | null }>) {
  const auth = await getAuthedClient()
  const calendar = google.calendar({ version: 'v3', auth })

  // Create a Monday-anchored ideal week starting next Monday
  const nextMonday = getNextMonday()
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone

  const highEnergyGoals = goals.filter(g => g.energy_level === 'high' || !g.energy_level)
  const lowEnergyGoals = goals.filter(g => g.energy_level === 'low')

  // Deep work block Mon/Wed/Fri 7–9am for high-energy goals
  for (const [i, day] of [0, 2, 4].entries()) {
    const date = new Date(nextMonday)
    date.setDate(date.getDate() + day)

    const goal = highEnergyGoals[i % Math.max(highEnergyGoals.length, 1)]
    const start = new Date(date)
    start.setHours(7, 0, 0, 0)
    const end = new Date(date)
    end.setHours(9, 0, 0, 0)

    await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: `🔵 Deep Work${goal ? `: ${goal.title}` : ''}`,
        description: 'Protected deep work block — high energy, no meetings.',
        start: { dateTime: start.toISOString(), timeZone: tz },
        end: { dateTime: end.toISOString(), timeZone: tz },
        recurrence: ['RRULE:FREQ=WEEKLY'],
        colorId: '9', // blueberry
        reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 15 }] },
      },
    })
  }

  // Weekly review Sunday 6pm
  const sunday = new Date(nextMonday)
  sunday.setDate(sunday.getDate() + 6)
  const reviewStart = new Date(sunday)
  reviewStart.setHours(18, 0, 0, 0)
  const reviewEnd = new Date(sunday)
  reviewEnd.setHours(18, 30, 0, 0)

  await calendar.events.insert({
    calendarId: 'primary',
    requestBody: {
      summary: '🗓️ Weekly Review — Life OS',
      description: 'Review goals, update progress, plan next week.',
      start: { dateTime: reviewStart.toISOString(), timeZone: tz },
      end: { dateTime: reviewEnd.toISOString(), timeZone: tz },
      recurrence: ['RRULE:FREQ=WEEKLY'],
      colorId: '5', // banana
      reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 30 }] },
    },
  })

  // Recharge block — no devices Fri 9pm
  const friday = new Date(nextMonday)
  friday.setDate(friday.getDate() + 4)
  const rechargeStart = new Date(friday)
  rechargeStart.setHours(21, 0, 0, 0)
  const rechargeEnd = new Date(friday)
  rechargeEnd.setHours(22, 0, 0, 0)

  await calendar.events.insert({
    calendarId: 'primary',
    requestBody: {
      summary: '🌿 Recharge — No Devices',
      description: 'Protected recharge time. Sustain pillar: protect your energy.',
      start: { dateTime: rechargeStart.toISOString(), timeZone: tz },
      end: { dateTime: rechargeEnd.toISOString(), timeZone: tz },
      recurrence: ['RRULE:FREQ=WEEKLY'],
      colorId: '10', // sage
    },
  })
}

export async function getTodayEvents() {
  const auth = await getAuthedClient()
  const calendar = google.calendar({ version: 'v3', auth })
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone

  const now = new Date()
  const endOfDay = new Date(now)
  endOfDay.setHours(23, 59, 59)

  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin: now.toISOString(),
    timeMax: endOfDay.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    timeZone: tz,
  })

  return res.data.items ?? []
}

export async function sendEmail(params: { to: string; subject: string; html: string }) {
  const auth = await getAuthedClient()
  const gmail = google.gmail({ version: 'v1', auth })

  // RFC 2047 encode subject so emojis/unicode survive transit
  const encodedSubject = `=?UTF-8?B?${Buffer.from(params.subject).toString('base64')}?=`

  const raw = [
    `To: ${params.to}`,
    `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    params.html,
  ].join('\r\n')

  const encoded = Buffer.from(raw).toString('base64url')

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encoded },
  })
}

export async function deleteIdealWeekEvents() {
  const auth = await getAuthedClient()
  const calendar = google.calendar({ version: 'v3', auth })
  let deleted = 0

  for (const query of ['Deep Work', 'Weekly Review — Life OS', 'Recharge — No Devices']) {
    const res = await calendar.events.list({ calendarId: 'primary', q: query, singleEvents: false, maxResults: 50 })
    for (const event of (res.data.items ?? [])) {
      if (event.id) {
        await calendar.events.delete({ calendarId: 'primary', eventId: event.id })
        deleted++
      }
    }
  }
  return deleted
}

export async function getWorkSchedule() {
  const auth = await getAuthedClient()
  const calendar = google.calendar({ version: 'v3', auth })
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone

  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay() + 1)
  weekStart.setHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59)

  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin: weekStart.toISOString(),
    timeMax: weekEnd.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    timeZone: tz,
    maxResults: 200,
  })

  const events = (res.data.items ?? []).map(e => ({
    summary: e.summary ?? 'Untitled',
    start: e.start?.dateTime ?? e.start?.date ?? '',
    end: e.end?.dateTime ?? e.end?.date ?? '',
    allDay: !e.start?.dateTime,
  }))

  const busyByDay: Record<string, Array<{ summary: string; start: string; end: string }>> = {}
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

  for (const event of events) {
    if (event.allDay) continue
    const date = new Date(event.start)
    const dayName = days[date.getDay() === 0 ? 6 : date.getDay() - 1]
    if (!busyByDay[dayName]) busyByDay[dayName] = []
    busyByDay[dayName].push({ summary: event.summary, start: event.start, end: event.end })
  }

  return { weekOf: weekStart.toISOString().split('T')[0], busyByDay, totalEvents: events.length }
}

function getNextMonday(): Date {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? 1 : 8 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  return monday
}
