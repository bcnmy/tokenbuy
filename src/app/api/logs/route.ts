import { NextResponse } from 'next/server'
import { log, queryLogs } from '@/lib/logger'
import type { LogLevel, LogCategory } from '@/lib/logger'

const VALID_LEVELS = new Set<LogLevel>(['debug', 'info', 'warn', 'error'])
const VALID_CATEGORIES = new Set<LogCategory>([
  'flow', 'quote', 'kyc', 'monerium', 'payment', 'webhook', 'bungee', 'client',
])

type IncomingLog = {
  level?: string
  category?: string
  event?: string
  sessionId?: string
  walletAddress?: string
  metadata?: Record<string, unknown>
  timestamp?: string
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const logs: IncomingLog[] = Array.isArray(body.logs) ? body.logs : []

    if (logs.length === 0) {
      return NextResponse.json({ ok: true, count: 0 })
    }

    let persisted = 0
    for (const entry of logs.slice(0, 100)) {
      if (!entry.event || typeof entry.event !== 'string') continue

      const level = VALID_LEVELS.has(entry.level as LogLevel)
        ? (entry.level as LogLevel)
        : 'info'
      const category = VALID_CATEGORIES.has(entry.category as LogCategory)
        ? (entry.category as LogCategory)
        : 'client'

      const metadata: Record<string, unknown> = { ...entry.metadata }
      if (entry.timestamp) {
        metadata.clientTimestamp = entry.timestamp
      }

      await log({
        level,
        category,
        event: entry.event,
        sessionId: entry.sessionId,
        walletAddress: entry.walletAddress,
        metadata: Object.keys(metadata).length ? metadata : undefined,
      })
      persisted++
    }

    return NextResponse.json({ ok: true, count: persisted })
  } catch (err) {
    console.error('Log ingestion error:', err)
    return NextResponse.json(
      { error: 'Failed to process logs' },
      { status: 500 },
    )
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    const rows = await queryLogs({
      sessionId: searchParams.get('sessionId') ?? undefined,
      walletAddress: searchParams.get('walletAddress') ?? undefined,
      category: (searchParams.get('category') as LogCategory) ?? undefined,
      level: (searchParams.get('level') as LogLevel) ?? undefined,
      since: searchParams.get('since') ?? undefined,
      limit: searchParams.has('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined,
      offset: searchParams.has('offset') ? parseInt(searchParams.get('offset')!, 10) : undefined,
    })

    return NextResponse.json({ logs: rows, count: rows.length })
  } catch (err) {
    console.error('Log query error:', err)
    return NextResponse.json(
      { error: 'Failed to query logs' },
      { status: 500 },
    )
  }
}
