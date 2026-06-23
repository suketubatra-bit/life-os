import { NextRequest, NextResponse } from 'next/server'
import type { InValue } from '@libsql/client'
import { getDb } from '@/lib/db'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = await getDb()
  const body = await request.json()

  const allowed = ['title','description','deadline','status','priority','energizer','blocker','burnout_signal','energy_level','ideal_week_slot']
  const updates = Object.entries(body).filter(([k]) => allowed.includes(k))
  if (!updates.length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  const setClause = updates.map(([k]) => `${k} = ?`).join(', ')
  const values = updates.map(([, v]) => v as InValue)

  await db.execute({
    sql: `UPDATE goals SET ${setClause}, updated_at = datetime('now') WHERE id = ?`,
    args: [...values, id],
  })

  const result = await db.execute({ sql: 'SELECT * FROM goals WHERE id = ?', args: [id] })
  return NextResponse.json(result.rows[0])
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = await getDb()
  await db.execute({ sql: 'DELETE FROM goals WHERE id = ?', args: [id] })
  return NextResponse.json({ ok: true })
}
