import { NextResponse } from 'next/server'
import { getDb, nanoid, Goal } from '@/lib/db'
import { getTodayEvents, sendEmail } from '@/lib/google-calendar'
import { SPHERE_AGENTS, runAllAgents } from '@/lib/sphere-agents'

export async function POST() {
  const db = await getDb()
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
  const results = await runAllAgents(goalsWithTasks, calendarEvents, userName)

  for (const { agent, checkin } of results) {
    await db.execute({
      sql: 'INSERT INTO agent_checkins (id, sphere_id, agent_name, message, questions, suggestions) VALUES (?, ?, ?, ?, ?, ?)',
      args: [nanoid(), agent.sphereId, agent.name, checkin.message, JSON.stringify(checkin.questions), JSON.stringify(checkin.suggestions)],
    })
  }

  const toEmail = process.env.USER_EMAIL
  if (toEmail) {
    try {
      const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })
      await sendEmail({ to: toEmail, subject: `🧠 Your 8 agents checked in — ${today}`, html: agentEmailTemplate(results, userName) })
    } catch {}
  }

  return NextResponse.json({ ok: true, checkins: results.map(r => ({ sphere: r.agent.sphereId, agent: r.agent.name, ...r.checkin })) })
}

export async function GET() {
  const db = await getDb()
  const checkins = await Promise.all(SPHERE_AGENTS.map(async agent => {
    const result = await db.execute({
      sql: 'SELECT * FROM agent_checkins WHERE sphere_id = ? ORDER BY created_at DESC LIMIT 1',
      args: [agent.sphereId],
    })
    const row = result.rows[0]
    return {
      agent,
      checkin: row ? {
        message: row.message as string,
        questions: JSON.parse(row.questions as string),
        suggestions: JSON.parse(row.suggestions as string),
        created_at: row.created_at as string,
      } : null,
    }
  }))
  return NextResponse.json(checkins)
}

function agentEmailTemplate(
  results: Array<{ agent: { name: string; emoji: string; sphereName: string; color: string }; checkin: { message: string; questions: string[]; suggestions: string[] } }>,
  userName: string
) {
  const sections = results.map(({ agent, checkin }) => `
    <tr><td style="padding:0 32px 24px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:12px;overflow:hidden;">
        <tr><td style="background:${agent.color};padding:12px 20px;">
          <span style="font-size:16px;font-weight:700;color:#1f2937;">${agent.emoji} ${agent.name} <span style="font-weight:400;color:#6b7280;">— ${agent.sphereName}</span></span>
        </td></tr>
        <tr><td style="padding:16px 20px;color:#374151;font-size:14px;line-height:1.6;">
          <p style="margin:0 0 12px;">${checkin.message}</p>
          ${checkin.questions.length ? `<p style="margin:0 0 4px;font-weight:600;color:#6b7280;font-size:12px;text-transform:uppercase;">Questions for you</p>${checkin.questions.map(q => `<p style="margin:0 0 4px;color:#4b5563;">→ ${q}</p>`).join('')}` : ''}
          ${checkin.suggestions.length ? `<p style="margin:12px 0 4px;font-weight:600;color:#6b7280;font-size:12px;text-transform:uppercase;">Suggestions</p>${checkin.suggestions.map(s => `<p style="margin:0 0 4px;color:#4b5563;">✦ ${s}</p>`).join('')}` : ''}
        </td></tr>
      </table>
    </td></tr>`).join('')

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;">
        <tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:24px 32px;">
          <p style="margin:0;color:#fff;font-size:20px;font-weight:700;">🧠 Your Life OS Team</p>
          <p style="margin:4px 0 0;color:rgba(255,255,255,.8);font-size:13px;">Good morning, ${userName}. Here's what your 8 agents have for you today.</p>
        </td></tr>
        ${sections}
        <tr><td style="padding:16px 32px 32px;border-top:1px solid #f3f4f6;">
          <p style="margin:0;color:#9ca3af;font-size:12px;">Life OS · 8 Sphere Agents</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}
