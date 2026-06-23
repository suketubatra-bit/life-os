import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { buildIdealWeek } from '@/lib/google-calendar'

export async function POST() {
  const db = await getDb()
  const result = await db.execute(
    `SELECT title, sphere_id, energizer, energy_level, ideal_week_slot FROM goals WHERE status = 'active'`
  )
  const goals = result.rows as unknown as Array<{
    title: string; sphere_id: string; energizer: string | null; energy_level: string | null; ideal_week_slot: string | null
  }>

  await buildIdealWeek(goals)
  return NextResponse.json({ ok: true, message: 'Ideal week created in Google Calendar' })
}
