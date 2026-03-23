import { NextResponse } from 'next/server'
import { getDb, ensureMigrations } from '@/lib/db'
import { verifyWebhookSignature } from '@/lib/sumsub'
import { logInfo, logWarn, logError } from '@/lib/logger'

export async function POST(request: Request) {
  try {
    const rawBody = await request.text()

    const webhookSecret = process.env.SUMSUB_WEBHOOK_SECRET
    if (webhookSecret) {
      const digest = request.headers.get('x-payload-digest') || ''
      if (!verifyWebhookSignature(rawBody, digest, webhookSecret)) {
        await logWarn('webhook', 'kyc_webhook_invalid_signature')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    const payload = JSON.parse(rawBody)
    const { externalUserId, type, reviewResult, applicantId } = payload

    await logInfo('webhook', 'kyc_webhook_received', {
      type,
      walletAddress: externalUserId,
      applicantId,
      reviewAnswer: reviewResult?.reviewAnswer,
    })

    if (!externalUserId) {
      return NextResponse.json({ ok: true })
    }

    if (type === 'applicantReviewed' || type === 'applicantPending') {
      const answer: string | undefined = reviewResult?.reviewAnswer
      let status = 'pending'
      if (answer === 'GREEN') status = 'approved'
      else if (answer === 'RED') status = 'rejected'

      await ensureMigrations()
      const db = getDb()
      const result = await db.execute({
        sql: 'SELECT id FROM kyc_sessions WHERE wallet_address = ?',
        args: [externalUserId],
      })

      if (result.rows[0]) {
        await db.execute({
          sql: "UPDATE kyc_sessions SET status = ?, review_answer = ?, updated_at = datetime('now') WHERE wallet_address = ?",
          args: [status, answer ?? null, externalUserId],
        })
      } else {
        await db.execute({
          sql: 'INSERT INTO kyc_sessions (wallet_address, applicant_id, status, review_answer) VALUES (?, ?, ?, ?)',
          args: [externalUserId, applicantId ?? '', status, answer ?? null],
        })
      }

      await logInfo('webhook', 'kyc_webhook_processed', {
        walletAddress: externalUserId,
        type,
        status,
        reviewAnswer: answer,
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    await logError('webhook', 'kyc_webhook_error', err)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 },
    )
  }
}
