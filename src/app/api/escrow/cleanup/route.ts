import { NextResponse } from 'next/server'
import { getDb, ensureMigrations } from '@/lib/db'
import { logInfo, logError } from '@/lib/logger'

export async function POST(request: Request) {
  try {
    const { flowId } = await request.json()
    if (!flowId || typeof flowId !== 'string') {
      return NextResponse.json({ error: 'flowId is required' }, { status: 400 })
    }

    await ensureMigrations()
    const db = getDb()

    await db.execute({
      sql: 'DELETE FROM escrow_keys WHERE flow_id = ?',
      args: [flowId],
    })

    await logInfo('flow', 'escrow_key_cleaned_up', { sessionId: flowId })

    return NextResponse.json({ success: true })
  } catch (err) {
    await logError('flow', 'escrow_cleanup_error', err)
    return NextResponse.json(
      { error: 'Failed to cleanup escrow key' },
      { status: 500 },
    )
  }
}
