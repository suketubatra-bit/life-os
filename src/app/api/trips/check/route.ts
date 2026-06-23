import { NextResponse } from 'next/server'
import { getDb, nanoid, Trip } from '@/lib/db'
import { sendEmail } from '@/lib/google-calendar'
import { generateTravelCheckin, YATRA, type TravelDeal } from '@/lib/travel-agent'
import { formatMoney } from '@/lib/flights'

export async function POST() {
  const db = await getDb()
  const tripsResult = await db.execute('SELECT * FROM trips')
  const trips = tripsResult.rows as unknown as Trip[]

  // Latest stored price per trip, to detect drops
  const priceHistory: Record<string, number> = {}
  const historyResult = await db.execute(`
    SELECT trip_id, price FROM price_checks pc
    WHERE checked_at = (SELECT MAX(checked_at) FROM price_checks WHERE trip_id = pc.trip_id)
  `)
  for (const row of historyResult.rows) {
    priceHistory[row.trip_id as string] = row.price as number
  }

  const userName = process.env.USER_NAME || 'Suketu'
  const result = await generateTravelCheckin(trips, priceHistory, userName)

  // Persist fresh price checks
  for (const q of result.quotes) {
    if (q.quote) {
      await db.execute({
        sql: `INSERT INTO price_checks (id, trip_id, price, currency, airline, depart_at, link)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [nanoid(), q.id, q.quote.price, q.quote.currency, q.quote.airline, q.quote.departAt, q.quote.link],
      })
    }
  }

  // Persist Yatra's check-in
  await db.execute({
    sql: 'INSERT INTO agent_checkins (id, sphere_id, agent_name, message, questions, suggestions) VALUES (?, ?, ?, ?, ?, ?)',
    args: [nanoid(), YATRA.sphereId, YATRA.name, result.message, JSON.stringify(result.questions), JSON.stringify(result.suggestions)],
  })

  // Email a low-price alert only when a deal hit target or price dropped
  const alertDeals = result.deals.filter(d => d.belowTarget || (d.dropFromLast ?? 0) > 0)
  const toEmail = process.env.USER_EMAIL
  if (toEmail && alertDeals.length) {
    try {
      await sendEmail({
        to: toEmail,
        subject: `✈️ Flight price alert — ${alertDeals.map(d => d.route).join(', ')}`,
        html: dealEmailTemplate(alertDeals, result.message, userName),
      })
    } catch {}
  }

  return NextResponse.json({
    ok: true,
    message: result.message,
    questions: result.questions,
    suggestions: result.suggestions,
    deals: result.deals,
    alertsSent: toEmail ? alertDeals.length : 0,
  })
}

export async function GET() {
  const db = await getDb()
  const result = await db.execute({
    sql: 'SELECT * FROM agent_checkins WHERE sphere_id = ? ORDER BY created_at DESC LIMIT 1',
    args: [YATRA.sphereId],
  })
  const row = result.rows[0]
  return NextResponse.json({
    agent: YATRA,
    checkin: row ? {
      message: row.message as string,
      questions: JSON.parse(row.questions as string),
      suggestions: JSON.parse(row.suggestions as string),
      created_at: row.created_at as string,
    } : null,
  })
}

function dealEmailTemplate(deals: TravelDeal[], message: string, userName: string): string {
  const rows = deals.map(d => `
    <tr><td style="padding:0 32px 16px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#ecfeff;border-radius:12px;border:1px solid #a5f3fc;">
        <tr><td style="padding:16px 20px;">
          <p style="margin:0 0 4px;font-size:18px;font-weight:700;color:#0e7490;">${d.route} — ${d.price}</p>
          <p style="margin:0;color:#155e75;font-size:13px;">
            ${d.belowTarget ? '🎯 Below your target price! ' : ''}${(d.dropFromLast ?? 0) > 0 ? `📉 Dropped ${formatMoney(d.dropFromLast!, 'INR')} since last check. ` : ''}${d.airline ? `Airline: ${d.airline}.` : ''}
          </p>
          ${d.link ? `<p style="margin:8px 0 0;"><a href="${d.link}" style="color:#0891b2;font-weight:600;font-size:13px;">View this fare →</a></p>` : ''}
        </td></tr>
      </table>
    </td></tr>`).join('')

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;">
        <tr><td style="background:linear-gradient(135deg,#06b6d4,#0891b2);padding:24px 32px;">
          <p style="margin:0;color:#fff;font-size:20px;font-weight:700;">✈️ Yatra — Flight Price Alert</p>
          <p style="margin:4px 0 0;color:rgba(255,255,255,.85);font-size:13px;">${userName}, a fare you're watching just got interesting.</p>
        </td></tr>
        <tr><td style="padding:24px 32px 8px;color:#374151;font-size:14px;line-height:1.6;">${message}</td></tr>
        ${rows}
        <tr><td style="padding:8px 32px 32px;border-top:1px solid #f3f4f6;">
          <p style="margin:0;color:#9ca3af;font-size:12px;">Life OS · Yatra travel agent</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}
