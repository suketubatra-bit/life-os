import { NextResponse } from 'next/server'
import { getWorkSchedule } from '@/lib/google-calendar'

export async function GET() {
  try {
    const schedule = await getWorkSchedule()
    return NextResponse.json(schedule)
  } catch {
    return NextResponse.json({ error: 'Calendar not connected' }, { status: 400 })
  }
}
