import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getApplicantByExternalId } from '@/lib/sumsub'
import { logInfo, logError } from '@/lib/logger'
import type { KycStatus } from '@/types'

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

    logInfo('kyc', 'kyc_status_check', { walletAddress: wallet })

    const db = getDb()
    const row = db
      .prepare('SELECT applicant_id, status FROM kyc_sessions WHERE wallet_address = ?')
      .get(wallet) as { applicant_id: string; status: string } | undefined

    if (row?.status === 'approved') {
      logInfo('kyc', 'kyc_status_result', { walletAddress: wallet, status: 'approved', source: 'db_cache' })
      return NextResponse.json({ status: 'approved' satisfies KycStatus })
    }

    const applicant = await getApplicantByExternalId(wallet)
    const answer = applicant?.review?.reviewResult?.reviewAnswer

    if (answer === 'GREEN') {
      if (row) {
        db.prepare(
          "UPDATE kyc_sessions SET status = 'approved', updated_at = datetime('now') WHERE wallet_address = ?",
        ).run(wallet)
      } else if (applicant) {
        db.prepare(
          'INSERT INTO kyc_sessions (wallet_address, applicant_id, status, review_answer) VALUES (?, ?, ?, ?)',
        ).run(wallet, applicant.id, 'approved', 'GREEN')
      }
      logInfo('kyc', 'kyc_status_result', { walletAddress: wallet, status: 'approved', source: 'sumsub_api' })
      return NextResponse.json({ status: 'approved' satisfies KycStatus })
    }

    if (answer === 'RED') {
      if (row) {
        db.prepare(
          "UPDATE kyc_sessions SET status = 'rejected', updated_at = datetime('now') WHERE wallet_address = ?",
        ).run(wallet)
      } else if (applicant) {
        db.prepare(
          'INSERT INTO kyc_sessions (wallet_address, applicant_id, status, review_answer) VALUES (?, ?, ?, ?)',
        ).run(wallet, applicant.id, 'rejected', 'RED')
      }
      logInfo('kyc', 'kyc_status_result', { walletAddress: wallet, status: 'rejected', source: 'sumsub_api' })
      return NextResponse.json({ status: 'rejected' satisfies KycStatus })
    }

    if (applicant && !row) {
      db.prepare(
        'INSERT INTO kyc_sessions (wallet_address, applicant_id, status) VALUES (?, ?, ?)',
      ).run(wallet, applicant.id, 'pending')
      logInfo('kyc', 'kyc_status_result', { walletAddress: wallet, status: 'pending', source: 'sumsub_api', newRecord: true })
      return NextResponse.json({ status: 'pending' satisfies KycStatus })
    }

    const status: KycStatus = row ? 'pending' : 'not_started'
    logInfo('kyc', 'kyc_status_result', { walletAddress: wallet, status })
    return NextResponse.json({ status })
  } catch (err) {
    const wallet = new URL(request.url).searchParams.get('wallet')
    logError('kyc', 'kyc_status_error', err, { walletAddress: wallet ?? undefined })
    return NextResponse.json(
      { error: 'Failed to check KYC status' },
      { status: 500 },
    )
  }
}
