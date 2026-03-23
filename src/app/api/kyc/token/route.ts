import { NextResponse } from 'next/server'
import { createApplicant, generateAccessToken } from '@/lib/sumsub'
import { getDb } from '@/lib/db'
import { logInfo, logError } from '@/lib/logger'

export async function POST(request: Request) {
  try {
    const { walletAddress } = await request.json()

    if (!walletAddress || typeof walletAddress !== 'string') {
      return NextResponse.json(
        { error: 'walletAddress is required' },
        { status: 400 },
      )
    }

    logInfo('kyc', 'kyc_token_requested', { walletAddress })

    const db = getDb()
    const existing = db
      .prepare('SELECT applicant_id, status FROM kyc_sessions WHERE wallet_address = ?')
      .get(walletAddress) as { applicant_id: string; status: string } | undefined

    if (!existing) {
      try {
        const applicant = await createApplicant(walletAddress)
        db.prepare(
          'INSERT INTO kyc_sessions (wallet_address, applicant_id, status) VALUES (?, ?, ?)',
        ).run(walletAddress, applicant.id, 'pending')
        logInfo('kyc', 'kyc_applicant_created', { walletAddress, applicantId: applicant.id })
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : ''
        if (!msg.includes('409')) throw e
        logInfo('kyc', 'kyc_applicant_already_exists', { walletAddress })
      }
    } else {
      logInfo('kyc', 'kyc_session_exists', { walletAddress, status: existing.status, applicantId: existing.applicant_id })
    }

    const { token } = await generateAccessToken(walletAddress)
    logInfo('kyc', 'kyc_token_generated', { walletAddress })
    return NextResponse.json({ token })
  } catch (err) {
    logError('kyc', 'kyc_token_error', err)
    return NextResponse.json(
      { error: 'Failed to generate KYC token' },
      { status: 500 },
    )
  }
}
