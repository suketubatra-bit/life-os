import { NextRequest, NextResponse } from 'next/server'
import type { InValue } from '@libsql/client'
import { getDb } from '@/lib/db'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = await getDb()
  const body = await request.json()

  const allowed = ['origin', 'destination', 'depart_date', 'return_date', 'target_price', 'currency', 'notes', 'status']
  const updates = Object.entries(body).filter(([k]) => allowed.includes(k))
  if (!updates.length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  const setClause = updates.map(([k]) => `${k} = ?`).join(', ')
  const values = updates.map(([, v]) => v as InValue)

  await db.execute({ sql: `UPDATE trips SET ${setClause} WHERE id = ?`, args: [...values, id] })
  const result = await db.execute({ sql: 'SELECT * FROM trips WHERE id = ?', args: [id] })
  return NextResponse.json(result.rows[0])
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = await getDb()
  await db.execute({ sql: 'DELETE FROM trips WHERE id = ?', args: [id] })
  return NextResponse.json({ ok: true })
}
