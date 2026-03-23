import { NextResponse } from 'next/server'
import { getDb, ensureMigrations } from '@/lib/db'
import {
  exchangeCodeForTokens,
  getAuthContext,
  getIBANs,
  requestIBAN,
  MONERIUM_CHAIN,
} from '@/lib/monerium'
import { logInfo, logWarn, logError } from '@/lib/logger'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  const baseUrl = new URL(request.url).origin

  if (error) {
    await logWarn('monerium', 'monerium_callback_error_param', {
      error,
      errorDescription: errorDescription ?? undefined,
    })
    const msg = encodeURIComponent(errorDescription || error)
    return NextResponse.redirect(`${baseUrl}/?monerium=error&message=${msg}`)
  }

  if (!code || !state) {
    await logWarn('monerium', 'monerium_callback_missing_params', {
      hasCode: !!code,
      hasState: !!state,
    })
    return NextResponse.redirect(`${baseUrl}/?monerium=error&message=Missing+authorization+code`)
  }

  await ensureMigrations()
  const db = getDb()

  const authResult = await db.execute({
    sql: 'SELECT code_verifier, wallet_address FROM monerium_auth_state WHERE state = ?',
    args: [state],
  })
  const authState = authResult.rows[0]

  if (!authState) {
    await logWarn('monerium', 'monerium_callback_invalid_state', { state })
    return NextResponse.redirect(`${baseUrl}/?monerium=error&message=Invalid+or+expired+state`)
  }

  const walletAddress = authState.wallet_address as string
  await logInfo('monerium', 'monerium_callback_processing', { walletAddress, state })

  await db.execute({
    sql: 'DELETE FROM monerium_auth_state WHERE state = ?',
    args: [state],
  })

  try {
    const tokens = await exchangeCodeForTokens(code, authState.code_verifier as string)
    await logInfo('monerium', 'monerium_tokens_exchanged', { walletAddress })

    const context = await getAuthContext(tokens.access_token)
    const profileId = context.defaultProfile
    const email = context.email

    await logInfo('monerium', 'monerium_auth_context_fetched', {
      walletAddress,
      profileId,
      hasEmail: !!email,
    })

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

    const existingResult = await db.execute({
      sql: 'SELECT id FROM monerium_profiles WHERE wallet_address = ?',
      args: [walletAddress],
    })

    if (existingResult.rows[0]) {
      await db.execute({
        sql: `UPDATE monerium_profiles SET
          email = ?, profile_id = ?, profile_state = 'approved',
          access_token = ?, refresh_token = ?, token_expires_at = ?,
          updated_at = datetime('now')
        WHERE wallet_address = ?`,
        args: [
          email, profileId,
          tokens.access_token, tokens.refresh_token, expiresAt,
          walletAddress,
        ],
      })
    } else {
      await db.execute({
        sql: `INSERT INTO monerium_profiles
          (wallet_address, email, profile_id, profile_state, access_token, refresh_token, token_expires_at, chain)
        VALUES (?, ?, ?, 'approved', ?, ?, ?, ?)`,
        args: [
          walletAddress, email, profileId,
          tokens.access_token, tokens.refresh_token, expiresAt,
          MONERIUM_CHAIN,
        ],
      })
    }

    await logInfo('monerium', 'monerium_profile_stored', { walletAddress, profileId, isUpdate: !!existingResult.rows[0] })

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
        await logInfo('monerium', 'monerium_existing_iban_found', { walletAddress, iban })
      } else {
        const newIban = await requestIBAN(tokens.access_token, {
          address: walletAddress,
          chain: MONERIUM_CHAIN,
        })
        iban = newIban.iban
        bic = newIban.bic
        await logInfo('monerium', 'monerium_new_iban_requested', { walletAddress, iban })
      }

      if (iban) {
        await db.execute({
          sql: "UPDATE monerium_profiles SET iban = ?, bic = ?, updated_at = datetime('now') WHERE wallet_address = ?",
          args: [iban, bic, walletAddress],
        })
      }
    } catch (ibanErr) {
      await logError('monerium', 'monerium_iban_after_auth_failed', ibanErr, { walletAddress })
    }

    await logInfo('monerium', 'monerium_callback_success', { walletAddress, hasIban: !!iban })

    const wallet = encodeURIComponent(walletAddress)
    return NextResponse.redirect(`${baseUrl}/?monerium=success&wallet=${wallet}`)
  } catch (err) {
    await logError('monerium', 'monerium_callback_error', err, { walletAddress })
    const msg = encodeURIComponent(err instanceof Error ? err.message : 'Authorization failed')
    return NextResponse.redirect(`${baseUrl}/?monerium=error&message=${msg}`)
  }
}
