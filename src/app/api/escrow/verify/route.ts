import { NextResponse } from 'next/server'
import { getDb, ensureMigrations } from '@/lib/db'
import { decryptFromStorage } from '@/lib/escrowCrypto'
import { logInfo, logError, logWarn } from '@/lib/logger'

const OTP_TTL_MS = 10 * 60 * 1000

export async function POST(request: Request) {
  try {
    const { email, otp } = await request.json()
    if (!email || !otp) {
      return NextResponse.json({ error: 'email and otp are required' }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()

    await ensureMigrations()
    const db = getDb()

    const otpRow = await db.execute({
      sql: 'SELECT otp, created_at FROM escrow_otps WHERE email = ?',
      args: [normalizedEmail],
    })

    if (otpRow.rows.length === 0) {
      await logWarn('flow', 'escrow_verify_no_otp', { walletAddress: normalizedEmail })
      return NextResponse.json({ error: 'No recovery code found. Please request a new one.' }, { status: 400 })
    }

    const row = otpRow.rows[0]
    const createdAt = new Date(row.created_at as string).getTime()

    if (Date.now() - createdAt > OTP_TTL_MS) {
      await db.execute({ sql: 'DELETE FROM escrow_otps WHERE email = ?', args: [normalizedEmail] })
      return NextResponse.json({ error: 'Recovery code expired. Please request a new one.' }, { status: 400 })
    }

    if (row.otp !== otp) {
      await logWarn('flow', 'escrow_verify_wrong_otp', { walletAddress: normalizedEmail })
      return NextResponse.json({ error: 'Invalid recovery code' }, { status: 400 })
    }

    await db.execute({ sql: 'DELETE FROM escrow_otps WHERE email = ?', args: [normalizedEmail] })

    const keyRow = await db.execute({
      sql: 'SELECT flow_id, encrypted_key, iv, recipient_address, email FROM escrow_keys WHERE email = ? ORDER BY created_at DESC LIMIT 1',
      args: [normalizedEmail],
    })

    if (keyRow.rows.length === 0) {
      return NextResponse.json({ error: 'No escrowed key found' }, { status: 404 })
    }

    const keyData = keyRow.rows[0]
    const privateKey = decryptFromStorage(
      keyData.encrypted_key as string,
      keyData.iv as string,
    )

    await logInfo('flow', 'escrow_key_recovered', {
      walletAddress: keyData.recipient_address as string,
    })

    return NextResponse.json({
      privateKey,
      flowId: keyData.flow_id,
      recipientAddress: keyData.recipient_address,
      email: keyData.email,
    })
  } catch (err) {
    await logError('flow', 'escrow_verify_error', err)
    return NextResponse.json(
      { error: 'Recovery verification failed' },
      { status: 500 },
    )
  }
}
