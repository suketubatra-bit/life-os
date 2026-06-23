import { NextRequest, NextResponse } from 'next/server'
import { getDb, nanoid } from '@/lib/db'
import { createDeadlineEvent } from '@/lib/google-calendar'

export async function GET() {
  const db = await getDb()
  const spheresResult = await db.execute('SELECT * FROM spheres ORDER BY sort_order')
  const goalsResult = await db.execute(`
    SELECT g.*, GROUP_CONCAT(t.id || '|' || t.title || '|' || t.done || '|' || t.sort_order, ';;;') as tasks_raw
    FROM goals g
    LEFT JOIN tasks t ON t.goal_id = g.id
    GROUP BY g.id
    ORDER BY g.created_at DESC
  `)

  const spheres = spheresResult.rows
  const goals = goalsResult.rows.map(g => ({
    ...g,
    tasks: g.tasks_raw
      ? String(g.tasks_raw).split(';;;').map(raw => {
          const [id, title, done, sort_order] = raw.split('|')
          return { id, title, done: Number(done), sort_order: Number(sort_order) }
        })
      : [],
    tasks_raw: undefined,
  }))

  return NextResponse.json({ spheres, goals })
}

export async function POST(request: NextRequest) {
  const db = await getDb()
  const body = await request.json()
  const id = nanoid()

  await db.execute({
    sql: `INSERT INTO goals (id, sphere_id, title, description, deadline, priority, energizer, blocker, burnout_signal, energy_level, ideal_week_slot)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id, body.sphere_id, body.title,
      body.description ?? null, body.deadline ?? null,
      body.priority ?? 'medium', body.energizer ?? null,
      body.blocker ?? null, body.burnout_signal ?? null,
      body.energy_level ?? null, body.ideal_week_slot ?? null,
    ],
  })

  const result = await db.execute({ sql: 'SELECT * FROM goals WHERE id = ?', args: [id] })
  const goal = result.rows[0]

  if (body.deadline) {
    createDeadlineEvent(body.title, body.deadline).catch(() => {})
  }

  return NextResponse.json(goal, { status: 201 })
}
