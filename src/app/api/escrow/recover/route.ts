import { NextResponse } from 'next/server'
import { getDb, ensureMigrations } from '@/lib/db'
import { logInfo, logError, logWarn } from '@/lib/logger'

const OTP_TTL_MS = 10 * 60 * 1000

function generateOtp(): string {
  const array = new Uint32Array(1)
  crypto.getRandomValues(array)
  return String(array[0] % 1000000).padStart(6, '0')
}

export async function POST(request: Request) {
  try {
    const { email } = await request.json()
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'email is required' }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()

    await ensureMigrations()
    const db = getDb()

    const existing = await db.execute({
      sql: 'SELECT flow_id FROM escrow_keys WHERE email = ? LIMIT 1',
      args: [normalizedEmail],
    })

    if (existing.rows.length === 0) {
      await logWarn('flow', 'escrow_recover_no_key', { walletAddress: normalizedEmail })
      return NextResponse.json(
        { error: 'No pending transaction found for this email' },
        { status: 404 },
      )
    }

    const otp = generateOtp()

    await db.execute({
      sql: 'INSERT OR REPLACE INTO escrow_otps (email, otp, created_at) VALUES (?, ?, datetime(\'now\'))',
      args: [normalizedEmail, otp],
    })

    // TODO: Replace with real email service (Resend / SendGrid / SES)
    // For development, log the OTP to the console and include in response
    console.log(`[ESCROW RECOVERY] OTP for ${normalizedEmail}: ${otp}`)

    await logInfo('flow', 'escrow_otp_sent', { walletAddress: normalizedEmail })

    return NextResponse.json({
      success: true,
      message: 'Recovery code sent to your email',
      // DEV ONLY: remove this in production
      _devOtp: process.env.NODE_ENV === 'development' ? otp : undefined,
    })
  } catch (err) {
    await logError('flow', 'escrow_recover_error', err)
    return NextResponse.json(
      { error: 'Failed to initiate recovery' },
      { status: 500 },
    )
  }
}
