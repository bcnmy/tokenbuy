import { NextResponse } from 'next/server'
import { getDb, ensureMigrations } from '@/lib/db'
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  buildAuthUrl,
  MONERIUM_CHAIN,
} from '@/lib/monerium'
import { logInfo, logError } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { walletAddress, signature, email } = await request.json()
    if (!walletAddress) {
      return NextResponse.json(
        { error: 'walletAddress is required' },
        { status: 400 },
      )
    }

    if (!process.env.MONERIUM_OAUTH_CLIENT_ID) {
      await logError('monerium', 'monerium_missing_client_id', new Error('MONERIUM_OAUTH_CLIENT_ID is not configured'))
      return NextResponse.json(
        { error: 'Monerium OAuth is not configured. Set MONERIUM_OAUTH_CLIENT_ID.' },
        { status: 500 },
      )
    }

    await logInfo('monerium', 'monerium_auth_requested', { walletAddress, hasEmail: !!email, hasSignature: !!signature })

    await ensureMigrations()
    const db = getDb()

    const codeVerifier = generateCodeVerifier()
    const codeChallenge = generateCodeChallenge(codeVerifier)
    const state = generateState()

    await db.execute({
      sql: 'INSERT OR REPLACE INTO monerium_auth_state (state, code_verifier, wallet_address) VALUES (?, ?, ?)',
      args: [state, codeVerifier, walletAddress],
    })

    const authUrl = buildAuthUrl({
      codeChallenge,
      state,
      walletAddress,
      signature: signature || undefined,
      email: email || undefined,
      chain: MONERIUM_CHAIN,
    })

    await logInfo('monerium', 'monerium_auth_url_generated', { walletAddress, state, authUrl })
    return NextResponse.json({ authUrl })
  } catch (err) {
    await logError('monerium', 'monerium_auth_error', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to start Monerium authorization' },
      { status: 500 },
    )
  }
}
