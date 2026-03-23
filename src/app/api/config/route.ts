import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import crypto from 'crypto'
import type { WidgetConfig } from '@/types/widget'
import { logInfo, logError } from '@/lib/logger'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const config = body.config as WidgetConfig

    if (!config || !config.accentColor) {
      return NextResponse.json({ error: 'Invalid configuration' }, { status: 400 })
    }

    const integratorKey = `tb_${crypto.randomBytes(16).toString('hex')}`

    const db = getDb()
    db.prepare(
      'INSERT INTO widget_configs (integrator_key, name, config) VALUES (?, ?, ?)'
    ).run(integratorKey, config.name || '', JSON.stringify(config))

    logInfo('flow', 'widget_config_created', { integratorKey, name: config.name })
    return NextResponse.json({ integratorKey })
  } catch (err) {
    logError('flow', 'widget_config_create_error', err)
    return NextResponse.json({ error: 'Failed to save configuration' }, { status: 500 })
  }
}
