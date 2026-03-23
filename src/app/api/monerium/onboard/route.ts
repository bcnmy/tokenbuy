import { NextResponse } from 'next/server'

/**
 * POST /api/monerium/onboard
 *
 * Deprecated: Programmatic signup requires extra privileges.
 * Use the PKCE authorization flow via /api/monerium/auth instead.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: 'Programmatic onboarding is not available. Use the authorization flow instead.',
      redirect: '/api/monerium/auth',
    },
    { status: 410 },
  )
}
