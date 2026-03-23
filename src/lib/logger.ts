import { getDb } from './db'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
export type LogCategory =
  | 'flow'
  | 'quote'
  | 'kyc'
  | 'monerium'
  | 'payment'
  | 'webhook'
  | 'bungee'
  | 'client'

export type LogEntry = {
  level: LogLevel
  category: LogCategory
  event: string
  sessionId?: string
  walletAddress?: string
  metadata?: Record<string, unknown>
}

export function log(entry: LogEntry) {
  const db = getDb()
  try {
    db.prepare(
      `INSERT INTO flow_logs (level, category, event, session_id, wallet_address, metadata)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      entry.level,
      entry.category,
      entry.event,
      entry.sessionId ?? null,
      entry.walletAddress ?? null,
      entry.metadata ? JSON.stringify(entry.metadata) : null,
    )
  } catch {
    console.error('[logger] failed to persist log:', entry.event)
  }
}

export function logInfo(category: LogCategory, event: string, meta?: Record<string, unknown> & { sessionId?: string; walletAddress?: string }) {
  const { sessionId, walletAddress, ...metadata } = meta ?? {}
  log({ level: 'info', category, event, sessionId, walletAddress, metadata: Object.keys(metadata).length ? metadata : undefined })
}

export function logWarn(category: LogCategory, event: string, meta?: Record<string, unknown> & { sessionId?: string; walletAddress?: string }) {
  const { sessionId, walletAddress, ...metadata } = meta ?? {}
  log({ level: 'warn', category, event, sessionId, walletAddress, metadata: Object.keys(metadata).length ? metadata : undefined })
}

export function logError(category: LogCategory, event: string, error?: unknown, meta?: Record<string, unknown> & { sessionId?: string; walletAddress?: string }) {
  const { sessionId, walletAddress, ...rest } = meta ?? {}
  const metadata: Record<string, unknown> = { ...rest }
  if (error instanceof Error) {
    metadata.errorMessage = error.message
    metadata.errorStack = error.stack
  } else if (error !== undefined) {
    metadata.errorMessage = String(error)
  }
  log({ level: 'error', category, event, sessionId, walletAddress, metadata: Object.keys(metadata).length ? metadata : undefined })
}

export type LogQueryParams = {
  sessionId?: string
  walletAddress?: string
  category?: LogCategory
  level?: LogLevel
  since?: string
  limit?: number
  offset?: number
}

export function queryLogs(params: LogQueryParams) {
  const db = getDb()
  const conditions: string[] = []
  const values: unknown[] = []

  if (params.sessionId) {
    conditions.push('session_id = ?')
    values.push(params.sessionId)
  }
  if (params.walletAddress) {
    conditions.push('wallet_address = ?')
    values.push(params.walletAddress)
  }
  if (params.category) {
    conditions.push('category = ?')
    values.push(params.category)
  }
  if (params.level) {
    conditions.push('level = ?')
    values.push(params.level)
  }
  if (params.since) {
    conditions.push('created_at >= ?')
    values.push(params.since)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = Math.min(params.limit ?? 200, 1000)
  const offset = params.offset ?? 0

  const rows = db
    .prepare(
      `SELECT id, level, category, event, session_id, wallet_address, metadata, created_at
       FROM flow_logs ${where}
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...values, limit, offset) as Array<{
      id: number
      level: string
      category: string
      event: string
      session_id: string | null
      wallet_address: string | null
      metadata: string | null
      created_at: string
    }>

  return rows.map((r) => ({
    id: r.id,
    level: r.level,
    category: r.category,
    event: r.event,
    sessionId: r.session_id,
    walletAddress: r.wallet_address,
    metadata: r.metadata ? JSON.parse(r.metadata) : null,
    createdAt: r.created_at,
  }))
}
