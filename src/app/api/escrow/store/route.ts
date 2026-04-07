import { NextResponse } from 'next/server'
import { getDb, ensureMigrations } from '@/lib/db'
import { encryptForStorage } from '@/lib/escrowCrypto'
import { logInfo, logError } from '@/lib/logger'

export async function POST(request: Request) {
  try {
    const { privateKey, email, recipientAddress, flowId } = await request.json()

    if (!privateKey || !email || !recipientAddress || !flowId) {
      return NextResponse.json(
        { error: 'privateKey, email, recipientAddress, and flowId are required' },
        { status: 400 },
      )
    }

    if (typeof privateKey !== 'string' || !privateKey.startsWith('0x') || privateKey.length !== 66) {
      return NextResponse.json({ error: 'Invalid key format' }, { status: 400 })
    }

    await ensureMigrations()
    const db = getDb()

    const { ciphertext, iv } = encryptForStorage(privateKey)

    await db.execute({
      sql: `INSERT OR REPLACE INTO escrow_keys (flow_id, email, recipient_address, encrypted_key, iv)
            VALUES (?, ?, ?, ?, ?)`,
      args: [flowId, email.toLowerCase().trim(), recipientAddress, ciphertext, iv],
    })

    await logInfo('flow', 'escrow_key_stored', {
      walletAddress: recipientAddress,
      // Never log the private key itself
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    await logError('flow', 'escrow_store_error', err)
    return NextResponse.json(
      { error: 'Failed to store escrow key' },
      { status: 500 },
    )
  }
}
