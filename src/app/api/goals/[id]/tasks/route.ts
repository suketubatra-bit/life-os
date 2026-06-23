import { NextRequest, NextResponse } from 'next/server'
import { getDb, nanoid } from '@/lib/db'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = await getDb()
  const { title } = await request.json()

  const maxResult = await db.execute({ sql: 'SELECT MAX(sort_order) as m FROM tasks WHERE goal_id = ?', args: [id] })
  const maxOrder = (maxResult.rows[0]?.m as number | null) ?? -1
  const taskId = nanoid()

  await db.execute({ sql: 'INSERT INTO tasks (id, goal_id, title, sort_order) VALUES (?, ?, ?, ?)', args: [taskId, id, title, maxOrder + 1] })
  const result = await db.execute({ sql: 'SELECT * FROM tasks WHERE id = ?', args: [taskId] })
  return NextResponse.json(result.rows[0], { status: 201 })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: goalId } = await params
  const db = await getDb()
  const { taskId, done, title } = await request.json()

  if (done !== undefined) {
    await db.execute({ sql: 'UPDATE tasks SET done = ? WHERE id = ? AND goal_id = ?', args: [done ? 1 : 0, taskId, goalId] })
  }
  if (title !== undefined) {
    await db.execute({ sql: 'UPDATE tasks SET title = ? WHERE id = ? AND goal_id = ?', args: [title, taskId, goalId] })
  }

  const result = await db.execute({ sql: 'SELECT * FROM tasks WHERE id = ?', args: [taskId] })
  return NextResponse.json(result.rows[0])
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: goalId } = await params
  const db = await getDb()
  const { taskId } = await request.json()
  await db.execute({ sql: 'DELETE FROM tasks WHERE id = ? AND goal_id = ?', args: [taskId, goalId] })
  return NextResponse.json({ ok: true })
}
