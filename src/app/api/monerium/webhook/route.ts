import { NextResponse } from 'next/server'
import { getDb, ensureMigrations } from '@/lib/db'
import { logInfo, logError } from '@/lib/logger'

export async function POST(request: Request) {
  try {
    const payload = await request.json()
    const { event, profile, iban, order } = payload

    await logInfo('webhook', 'monerium_webhook_received', {
      event,
      profileId: profile?.id,
      ibanProfile: iban?.profile,
      orderId: order?.id,
    })

    await ensureMigrations()
    const db = getDb()

    if (event === 'profile.updated' && profile?.id) {
      await db.execute({
        sql: "UPDATE monerium_profiles SET profile_state = ?, updated_at = datetime('now') WHERE profile_id = ?",
        args: [profile.state || 'pending', profile.id],
      })

      await logInfo('webhook', 'monerium_profile_updated', {
        profileId: profile.id,
        state: profile.state,
      })
    }

    if (event === 'iban.updated' && iban?.profile) {
      if (iban.iban) {
        await db.execute({
          sql: "UPDATE monerium_profiles SET iban = ?, bic = ?, updated_at = datetime('now') WHERE profile_id = ?",
          args: [iban.iban, iban.bic || null, iban.profile],
        })

        await logInfo('webhook', 'monerium_iban_updated', {
          profileId: iban.profile,
          iban: iban.iban,
          ibanState: iban.state,
        })
      }
    }

    if ((event === 'order.created' || event === 'order.updated') && order) {
      await logInfo('webhook', 'monerium_order_event', {
        event,
        orderId: order.id,
        kind: order.kind,
        amount: order.amount,
        currency: order.currency,
        status: order.meta?.state,
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    await logError('webhook', 'monerium_webhook_error', err)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 },
    )
  }
}
