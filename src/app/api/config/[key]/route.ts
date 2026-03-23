import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { logInfo, logWarn, logError } from '@/lib/logger'
import { normalizeConfig } from '@/types/widget'

type Row = {
  integrator_key: string
  name: string
  config: string
  created_at: string
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params

    if (!key || !key.startsWith('tb_')) {
      return NextResponse.json({ error: 'Invalid key format' }, { status: 400 })
    }

    const db = getDb()
    const row = db.prepare(
      'SELECT * FROM widget_configs WHERE integrator_key = ?'
    ).get(key) as Row | undefined

    if (!row) {
      logWarn('flow', 'widget_config_not_found', { integratorKey: key })
      return NextResponse.json({ error: 'Configuration not found' }, { status: 404 })
    }

    logInfo('flow', 'widget_config_loaded', { integratorKey: key, name: row.name })
    return NextResponse.json({
      integratorKey: row.integrator_key,
      name: row.name,
      config: normalizeConfig(JSON.parse(row.config)),
      createdAt: row.created_at,
    })
  } catch (err) {
    logError('flow', 'widget_config_load_error', err)
    return NextResponse.json({ error: 'Failed to fetch configuration' }, { status: 500 })
  }
}
