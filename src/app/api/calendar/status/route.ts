import { NextResponse } from 'next/server'
import { loadTokens } from '@/lib/google-calendar'

export async function GET() {
  const tokens = await loadTokens()
  const connected = !!(tokens?.refresh_token)
  return NextResponse.json({ connected })
}
