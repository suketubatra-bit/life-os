import { NextResponse } from 'next/server'
import { deleteIdealWeekEvents } from '@/lib/google-calendar'

export async function POST() {
  const deleted = await deleteIdealWeekEvents()
  return NextResponse.json({ ok: true, deleted })
}
