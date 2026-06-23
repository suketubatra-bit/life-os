import { NextRequest, NextResponse } from 'next/server'
import { getDb, nanoid, Goal, Sphere } from '@/lib/db'
import { generateDailyBrief } from '@/lib/claude'
import { getTodayEvents, sendEmail } from '@/lib/google-calendar'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const type: 'morning' | 'evening' = body.type === 'evening' ? 'evening' : 'morning'

  const db = await getDb()
  const spheresResult = await db.execute('SELECT * FROM spheres ORDER BY sort_order')
  const spheres = spheresResult.rows as unknown as Sphere[]

  const goalsResult = await db.execute(`
    SELECT g.*, GROUP_CONCAT(t.id || '|' || t.title || '|' || t.done, ';;;') as tasks_raw
    FROM goals g LEFT JOIN tasks t ON t.goal_id = g.id
    WHERE g.status = 'active'
    GROUP BY g.id
  `)

  const goalsWithTasks = goalsResult.rows.map(g => ({
    ...(g as unknown as Goal),
    tasks: (g.tasks_raw as string | null)
      ? String(g.tasks_raw).split(';;;').map(raw => {
          const [id, title, done] = raw.split('|')
          return { id, title, done: Number(done) }
        })
      : [],
  }))

  let calendarEvents: Array<{ summary?: string | null; start?: { dateTime?: string | null } | null }> = []
  try { calendarEvents = await getTodayEvents() } catch {}

  const userName = process.env.USER_NAME || 'Suketu'
  const content = await generateDailyBrief(type, goalsWithTasks, spheres, calendarEvents, userName)

  const briefId = nanoid()
  await db.execute({ sql: 'INSERT INTO daily_briefs (id, type, content) VALUES (?, ?, ?)', args: [briefId, type, content] })

  const toEmail = process.env.USER_EMAIL
  if (toEmail) {
    const subject = type === 'morning'
      ? `☀️ Your morning brief — ${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}`
      : `🌙 Evening check-in — ${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}`
    try {
      await sendEmail({ to: toEmail, subject, html: emailTemplate(content, type) })
    } catch {}
  }

  return NextResponse.json({ ok: true, content, type })
}

export async function GET() {
  const db = await getDb()
  const result = await db.execute('SELECT * FROM daily_briefs ORDER BY sent_at DESC LIMIT 1')
  return NextResponse.json(result.rows[0] ?? null)
}

function emailTemplate(content: string, type: 'morning' | 'evening'): string {
  const paragraphs = content.split('\n\n').filter(Boolean)
  const htmlParagraphs = paragraphs.map(p => `<p style="margin:0 0 16px;line-height:1.7;">${p.replace(/\n/g, '<br>')}</p>`).join('')
  const accent = type === 'morning' ? '#fbbf24' : '#6366f1'
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
        <tr><td style="background:${accent};padding:20px 32px;">
          <p style="margin:0;color:#fff;font-size:13px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;">
            ${type === 'morning' ? '☀️ Morning Brief' : '🌙 Evening Check-in'}
          </p>
        </td></tr>
        <tr><td style="padding:32px;color:#374151;font-size:16px;">${htmlParagraphs}</td></tr>
        <tr><td style="padding:16px 32px 32px;border-top:1px solid #f3f4f6;">
          <p style="margin:0;color:#9ca3af;font-size:12px;">Life OS · powered by Claude</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}
