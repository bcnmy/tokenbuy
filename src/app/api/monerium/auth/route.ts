import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  buildAuthUrl,
  MONERIUM_CHAIN,
} from '@/lib/monerium'
import { logInfo, logError } from '@/lib/logger'

export async function POST(request: Request) {
  try {
    const { walletAddress, email } = await request.json()
    if (!walletAddress) {
      return NextResponse.json(
        { error: 'walletAddress is required' },
        { status: 400 },
      )
    }

    logInfo('monerium', 'monerium_auth_requested', { walletAddress, hasEmail: !!email })

    const db = getDb()

    const existing = db
      .prepare('SELECT iban, bic FROM monerium_profiles WHERE wallet_address = ? AND iban IS NOT NULL')
      .get(walletAddress) as { iban: string; bic: string } | undefined

    if (existing) {
      logInfo('monerium', 'monerium_already_onboarded', { walletAddress, hasIban: true })
      return NextResponse.json({
        alreadyOnboarded: true,
        iban: existing.iban,
        bic: existing.bic,
      })
    }

    const codeVerifier = generateCodeVerifier()
    const codeChallenge = generateCodeChallenge(codeVerifier)
    const state = generateState()

    db.prepare(
      'INSERT OR REPLACE INTO monerium_auth_state (state, code_verifier, wallet_address) VALUES (?, ?, ?)',
    ).run(state, codeVerifier, walletAddress)

    const authUrl = buildAuthUrl({
      codeChallenge,
      state,
      walletAddress,
      email: email || undefined,
      chain: MONERIUM_CHAIN,
    })

    logInfo('monerium', 'monerium_auth_url_generated', { walletAddress, state })
    return NextResponse.json({ authUrl })
  } catch (err) {
    logError('monerium', 'monerium_auth_error', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to start Monerium authorization' },
      { status: 500 },
    )
  }
}
