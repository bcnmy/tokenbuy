import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import {
  exchangeCodeForTokens,
  getAuthContext,
  getIBANs,
  requestIBAN,
  MONERIUM_CHAIN,
} from '@/lib/monerium'
import { logInfo, logWarn, logError } from '@/lib/logger'

type AuthStateRow = {
  code_verifier: string
  wallet_address: string
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  const baseUrl = new URL(request.url).origin

  if (error) {
    logWarn('monerium', 'monerium_callback_error_param', {
      error,
      errorDescription: errorDescription ?? undefined,
    })
    const msg = encodeURIComponent(errorDescription || error)
    return NextResponse.redirect(`${baseUrl}/?monerium=error&message=${msg}`)
  }

  if (!code || !state) {
    logWarn('monerium', 'monerium_callback_missing_params', {
      hasCode: !!code,
      hasState: !!state,
    })
    return NextResponse.redirect(`${baseUrl}/?monerium=error&message=Missing+authorization+code`)
  }

  const db = getDb()

  const authState = db
    .prepare('SELECT code_verifier, wallet_address FROM monerium_auth_state WHERE state = ?')
    .get(state) as AuthStateRow | undefined

  if (!authState) {
    logWarn('monerium', 'monerium_callback_invalid_state', { state })
    return NextResponse.redirect(`${baseUrl}/?monerium=error&message=Invalid+or+expired+state`)
  }

  const walletAddress = authState.wallet_address
  logInfo('monerium', 'monerium_callback_processing', { walletAddress, state })

  db.prepare('DELETE FROM monerium_auth_state WHERE state = ?').run(state)

  try {
    const tokens = await exchangeCodeForTokens(code, authState.code_verifier)
    logInfo('monerium', 'monerium_tokens_exchanged', { walletAddress })

    const context = await getAuthContext(tokens.access_token)
    const profileId = context.defaultProfile
    const email = context.email

    logInfo('monerium', 'monerium_auth_context_fetched', {
      walletAddress,
      profileId,
      hasEmail: !!email,
    })

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

    const existing = db
      .prepare('SELECT id FROM monerium_profiles WHERE wallet_address = ?')
      .get(walletAddress) as { id: number } | undefined

    if (existing) {
      db.prepare(
        `UPDATE monerium_profiles SET
          email = ?, profile_id = ?, profile_state = 'approved',
          access_token = ?, refresh_token = ?, token_expires_at = ?,
          updated_at = datetime('now')
        WHERE wallet_address = ?`,
      ).run(
        email, profileId,
        tokens.access_token, tokens.refresh_token, expiresAt,
        walletAddress,
      )
    } else {
      db.prepare(
        `INSERT INTO monerium_profiles
          (wallet_address, email, profile_id, profile_state, access_token, refresh_token, token_expires_at, chain)
        VALUES (?, ?, ?, 'approved', ?, ?, ?, ?)`,
      ).run(
        walletAddress, email, profileId,
        tokens.access_token, tokens.refresh_token, expiresAt,
        MONERIUM_CHAIN,
      )
    }

    logInfo('monerium', 'monerium_profile_stored', { walletAddress, profileId, isUpdate: !!existing })

    let iban: string | null = null
    let bic: string | null = null

    try {
      const existingIbans = await getIBANs(tokens.access_token)
      const matching = existingIbans.find(
        (i) => i.address?.toLowerCase() === walletAddress.toLowerCase(),
      )

      if (matching) {
        iban = matching.iban
        bic = matching.bic
        logInfo('monerium', 'monerium_existing_iban_found', { walletAddress, iban })
      } else {
        const newIban = await requestIBAN(tokens.access_token, {
          address: walletAddress,
          chain: MONERIUM_CHAIN,
        })
        iban = newIban.iban
        bic = newIban.bic
        logInfo('monerium', 'monerium_new_iban_requested', { walletAddress, iban })
      }

      if (iban) {
        db.prepare(
          "UPDATE monerium_profiles SET iban = ?, bic = ?, updated_at = datetime('now') WHERE wallet_address = ?",
        ).run(iban, bic, walletAddress)
      }
    } catch (ibanErr) {
      logError('monerium', 'monerium_iban_after_auth_failed', ibanErr, { walletAddress })
    }

    logInfo('monerium', 'monerium_callback_success', { walletAddress, hasIban: !!iban })

    const wallet = encodeURIComponent(walletAddress)
    return NextResponse.redirect(`${baseUrl}/?monerium=success&wallet=${wallet}`)
  } catch (err) {
    logError('monerium', 'monerium_callback_error', err, { walletAddress })
    const msg = encodeURIComponent(err instanceof Error ? err.message : 'Authorization failed')
    return NextResponse.redirect(`${baseUrl}/?monerium=error&message=${msg}`)
  }
}
