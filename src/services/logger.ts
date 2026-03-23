type LogLevel = 'debug' | 'info' | 'warn' | 'error'
type LogCategory = 'flow' | 'quote' | 'kyc' | 'monerium' | 'payment' | 'bungee' | 'client'

type ClientLogEntry = {
  level: LogLevel
  category: LogCategory
  event: string
  sessionId?: string
  walletAddress?: string
  metadata?: Record<string, unknown>
  timestamp: string
}

const FLUSH_INTERVAL_MS = 2000
const MAX_BATCH_SIZE = 25

let sessionId: string | null = null
let buffer: ClientLogEntry[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null

function getSessionId(): string {
  if (!sessionId) {
    sessionId = `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  }
  return sessionId
}

export function resetSession() {
  sessionId = null
}

export function getClientSessionId(): string {
  return getSessionId()
}

function scheduleFlush() {
  if (flushTimer) return
  flushTimer = setTimeout(flush, FLUSH_INTERVAL_MS)
}

async function flush() {
  flushTimer = null
  if (buffer.length === 0) return

  const batch = buffer.splice(0, MAX_BATCH_SIZE)

  try {
    const res = await fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logs: batch }),
    })
    if (!res.ok) {
      console.warn('[logger] failed to flush logs:', res.status)
    }
  } catch {
    console.warn('[logger] failed to flush logs (network error)')
  }

  if (buffer.length > 0) {
    scheduleFlush()
  }
}

function enqueue(entry: ClientLogEntry) {
  buffer.push(entry)
  if (buffer.length >= MAX_BATCH_SIZE) {
    flush()
  } else {
    scheduleFlush()
  }
}

function buildEntry(
  level: LogLevel,
  category: LogCategory,
  event: string,
  meta?: Record<string, unknown> & { walletAddress?: string },
): ClientLogEntry {
  const { walletAddress, ...metadata } = meta ?? {}
  return {
    level,
    category,
    event,
    sessionId: getSessionId(),
    walletAddress,
    metadata: Object.keys(metadata).length ? metadata : undefined,
    timestamp: new Date().toISOString(),
  }
}

export function logInfo(category: LogCategory, event: string, meta?: Record<string, unknown> & { walletAddress?: string }) {
  enqueue(buildEntry('info', category, event, meta))
}

export function logWarn(category: LogCategory, event: string, meta?: Record<string, unknown> & { walletAddress?: string }) {
  enqueue(buildEntry('warn', category, event, meta))
}

export function logError(category: LogCategory, event: string, error?: unknown, meta?: Record<string, unknown> & { walletAddress?: string }) {
  const extra: Record<string, unknown> = { ...meta }
  if (error instanceof Error) {
    extra.errorMessage = error.message
    extra.errorStack = error.stack
  } else if (error !== undefined) {
    extra.errorMessage = String(error)
  }
  enqueue(buildEntry('error', category, event, extra as Record<string, unknown> & { walletAddress?: string }))
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (buffer.length > 0) {
      const batch = buffer.splice(0)
      try {
        navigator.sendBeacon(
          '/api/logs',
          new Blob([JSON.stringify({ logs: batch })], { type: 'application/json' }),
        )
      } catch {
        // best-effort
      }
    }
  })
}
