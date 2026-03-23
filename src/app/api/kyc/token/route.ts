import { NextResponse } from 'next/server'
import { createApplicant, generateAccessToken } from '@/lib/sumsub'
import { getDb, ensureMigrations } from '@/lib/db'
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

    await logInfo('kyc', 'kyc_token_requested', { walletAddress })

    await ensureMigrations()
    const db = getDb()
    const result = await db.execute({
      sql: 'SELECT applicant_id, status FROM kyc_sessions WHERE wallet_address = ?',
      args: [walletAddress],
    })
    const existing = result.rows[0]

    if (!existing) {
      try {
        const applicant = await createApplicant(walletAddress)
        await db.execute({
          sql: 'INSERT INTO kyc_sessions (wallet_address, applicant_id, status) VALUES (?, ?, ?)',
          args: [walletAddress, applicant.id, 'pending'],
        })
        await logInfo('kyc', 'kyc_applicant_created', { walletAddress, applicantId: applicant.id })
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : ''
        if (!msg.includes('409')) throw e
        await logInfo('kyc', 'kyc_applicant_already_exists', { walletAddress })
      }
    } else {
      await logInfo('kyc', 'kyc_session_exists', { walletAddress, status: existing.status as string, applicantId: existing.applicant_id as string })
    }

    const { token } = await generateAccessToken(walletAddress)
    await logInfo('kyc', 'kyc_token_generated', { walletAddress })
    return NextResponse.json({ token })
  } catch (err) {
    await logError('kyc', 'kyc_token_error', err)
    return NextResponse.json(
      { error: 'Failed to generate KYC token' },
      { status: 500 },
    )
  }
}
