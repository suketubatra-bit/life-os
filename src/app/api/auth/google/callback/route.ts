import { NextRequest, NextResponse } from 'next/server'
import { getOAuth2Client, saveTokens } from '@/lib/google-calendar'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(new URL('/?cal=error', request.url))
  }

  const auth = getOAuth2Client()
  const { tokens } = await auth.getToken(code)
  await saveTokens(tokens)

  return NextResponse.redirect(new URL('/?cal=connected', request.url))
}
