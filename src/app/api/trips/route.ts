import { NextRequest, NextResponse } from 'next/server'
import { getDb, nanoid, Trip } from '@/lib/db'

export async function GET() {
  const db = await getDb()
  const result = await db.execute(`
    SELECT t.*, (
      SELECT pc.price FROM price_checks pc WHERE pc.trip_id = t.id ORDER BY pc.checked_at DESC LIMIT 1
    ) as latest_price, (
      SELECT pc.link FROM price_checks pc WHERE pc.trip_id = t.id ORDER BY pc.checked_at DESC LIMIT 1
    ) as latest_link, (
      SELECT pc.checked_at FROM price_checks pc WHERE pc.trip_id = t.id ORDER BY pc.checked_at DESC LIMIT 1
    ) as latest_checked_at
    FROM trips t
    ORDER BY t.depart_date ASC
  `)
  return NextResponse.json(result.rows)
}

export async function POST(request: NextRequest) {
  const db = await getDb()
  const body = await request.json()

  const origin = String(body.origin ?? '').trim().toUpperCase()
  const destination = String(body.destination ?? '').trim().toUpperCase()
  const depart_date = String(body.depart_date ?? '').trim()

  if (!origin || !destination || !depart_date) {
    return NextResponse.json({ error: 'origin, destination and depart_date are required' }, { status: 400 })
  }

  const id = nanoid()
  await db.execute({
    sql: `INSERT INTO trips (id, origin, destination, depart_date, return_date, target_price, currency, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id, origin, destination, depart_date,
      body.return_date ? String(body.return_date).trim() : null,
      body.target_price != null && body.target_price !== '' ? Math.round(Number(body.target_price)) : null,
      String(body.currency ?? 'INR').trim().toUpperCase() || 'INR',
      body.notes ? String(body.notes).trim() : null,
    ],
  })

  const result = await db.execute({ sql: 'SELECT * FROM trips WHERE id = ?', args: [id] })
  return NextResponse.json(result.rows[0] as unknown as Trip, { status: 201 })
}
