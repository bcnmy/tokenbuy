import { NextResponse } from 'next/server'
import { getDb, ensureMigrations } from '@/lib/db'
import { logInfo, logError } from '@/lib/logger'

export async function POST(request: Request) {
  try {
    const { walletAddress } = await request.json()
    if (!walletAddress) {
      return NextResponse.json(
        { error: 'walletAddress is required' },
        { status: 400 },
      )
    }

    await ensureMigrations()
    const db = getDb()

    await db.execute({
      sql: 'DELETE FROM monerium_profiles WHERE wallet_address = ?',
      args: [walletAddress],
    })

    await db.execute({
      sql: 'DELETE FROM monerium_auth_state WHERE wallet_address = ?',
      args: [walletAddress],
    })

    await logInfo('monerium', 'monerium_logged_out', { walletAddress })
    return NextResponse.json({ ok: true })
  } catch (err) {
    await logError('monerium', 'monerium_logout_error', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Logout failed' },
      { status: 500 },
    )
  }
}
