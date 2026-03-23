import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import {
  getIBANs,
  requestIBAN,
  refreshAccessToken,
  MONERIUM_CHAIN,
} from '@/lib/monerium'
import { logInfo, logWarn, logError } from '@/lib/logger'

type MoneriumRow = {
  profile_id: string
  profile_state: string
  access_token: string | null
  refresh_token: string | null
  token_expires_at: string | null
  iban: string | null
  bic: string | null
  chain: string
}

async function getValidToken(row: MoneriumRow, wallet: string): Promise<string | null> {
  if (!row.access_token) return null

  const expiresAt = row.token_expires_at ? new Date(row.token_expires_at).getTime() : 0
  if (Date.now() < expiresAt - 30_000) {
    return row.access_token
  }

  if (!row.refresh_token) return null

  try {
    logInfo('monerium', 'monerium_token_refresh', { walletAddress: wallet })
    const tokens = await refreshAccessToken(row.refresh_token)
    const newExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    const db = getDb()
    db.prepare(
      "UPDATE monerium_profiles SET access_token = ?, refresh_token = ?, token_expires_at = ?, updated_at = datetime('now') WHERE wallet_address = ?",
    ).run(tokens.access_token, tokens.refresh_token, newExpiry, wallet)
    logInfo('monerium', 'monerium_token_refreshed', { walletAddress: wallet })
    return tokens.access_token
  } catch (err) {
    logError('monerium', 'monerium_token_refresh_failed', err, { walletAddress: wallet })
    return null
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const wallet = searchParams.get('wallet')

    if (!wallet) {
      return NextResponse.json(
        { error: 'wallet query param is required' },
        { status: 400 },
      )
    }

    logInfo('monerium', 'iban_requested', { walletAddress: wallet })

    const db = getDb()
    const row = db
      .prepare(
        `SELECT profile_id, profile_state, access_token, refresh_token,
                token_expires_at, iban, bic, chain
         FROM monerium_profiles WHERE wallet_address = ?`,
      )
      .get(wallet) as MoneriumRow | undefined

    if (!row) {
      logInfo('monerium', 'iban_no_profile', { walletAddress: wallet })
      return NextResponse.json({
        iban: null,
        bic: null,
        profileState: 'none',
        ready: false,
        needsAuth: true,
      })
    }

    const accessToken = await getValidToken(row, wallet)
    if (!accessToken) {
      logWarn('monerium', 'iban_no_valid_token', { walletAddress: wallet, profileState: row.profile_state })
      return NextResponse.json({
        iban: null,
        bic: null,
        profileState: row.profile_state,
        ready: false,
        needsAuth: true,
      })
    }

    try {
      const ibans = await getIBANs(accessToken)
      const matching = ibans.find(
        (i) => i.address?.toLowerCase() === wallet.toLowerCase(),
      )

      if (matching) {
        logInfo('monerium', 'iban_found_via_api', { walletAddress: wallet, iban: matching.iban })
        return NextResponse.json({
          iban: matching.iban,
          bic: matching.bic,
          beneficiary: matching.name || 'Monerium ehf.',
          profileState: 'approved',
          ready: true,
          needsAuth: false,
        })
      }

      logInfo('monerium', 'iban_requesting_new', { walletAddress: wallet, chain: row.chain })
      const newIban = await requestIBAN(accessToken, {
        address: wallet,
        chain: row.chain,
      })

      logInfo('monerium', 'iban_created', { walletAddress: wallet, iban: newIban.iban })
      return NextResponse.json({
        iban: newIban.iban,
        bic: newIban.bic,
        beneficiary: newIban.name || 'Monerium ehf.',
        profileState: 'approved',
        ready: true,
        needsAuth: false,
      })
    } catch (ibanErr) {
      logError('monerium', 'iban_fetch_failed', ibanErr, { walletAddress: wallet })
      return NextResponse.json({
        iban: null,
        bic: null,
        profileState: row.profile_state,
        ready: false,
        needsAuth: false,
        error: 'IBAN not yet available. Wallet address may need to be linked in Monerium.',
      })
    }
  } catch (err) {
    const wallet = new URL(request.url).searchParams.get('wallet')
    logError('monerium', 'iban_error', err, { walletAddress: wallet ?? undefined })
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to get IBAN' },
      { status: 500 },
    )
  }
}
