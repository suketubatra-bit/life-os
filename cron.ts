import cron from 'node-cron'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

async function runAgents() {
  try {
    const res = await fetch(`${BASE_URL}/api/agents/daily`, { method: 'POST' })
    const data = await res.json()
    console.log(`[${new Date().toISOString()}] All 8 agents ran — email sent`)
    console.log(data.checkins?.map((c: { agent: string; message: string }) => `  ${c.agent}: ${c.message.slice(0, 60)}...`).join('\n'))
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Agent run failed:`, err)
  }
}

async function sendBrief(type: 'morning' | 'evening') {
  try {
    const res = await fetch(`${BASE_URL}/api/daily-brief`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    })
    const data = await res.json()
    console.log(`[${new Date().toISOString()}] ${type} brief sent`)
    console.log(data.content?.slice(0, 120) + '...')
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Failed to send ${type} brief:`, err)
  }
}

// 8:00am — Run all 8 sphere agents + morning brief
cron.schedule('0 8 * * *', async () => {
  await runAgents()
  await sendBrief('morning')
}, { timezone: 'Asia/Kolkata' })

// 9:00pm — Evening brief
cron.schedule('0 21 * * *', () => sendBrief('evening'), { timezone: 'Asia/Kolkata' })

console.log('Life OS cron running:')
console.log('  8:00am IST — 8 sphere agents + morning brief + email')
console.log('  9:00pm IST — evening brief + email')
console.log('Press Ctrl+C to stop.')
