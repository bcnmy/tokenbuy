import { NextResponse } from 'next/server'
import { getDb, ensureMigrations } from '@/lib/db'
import { logInfo, logWarn, logError } from '@/lib/logger'
import { normalizeConfig } from '@/types/widget'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params

    if (!key || !key.startsWith('tb_')) {
      return NextResponse.json({ error: 'Invalid key format' }, { status: 400 })
    }

    await ensureMigrations()
    const db = getDb()
    const result = await db.execute({
      sql: 'SELECT * FROM widget_configs WHERE integrator_key = ?',
      args: [key],
    })
    const row = result.rows[0]

    if (!row) {
      await logWarn('flow', 'widget_config_not_found', { integratorKey: key })
      return NextResponse.json({ error: 'Configuration not found' }, { status: 404 })
    }

    await logInfo('flow', 'widget_config_loaded', { integratorKey: key, name: row.name as string })
    return NextResponse.json({
      integratorKey: row.integrator_key,
      name: row.name,
      config: normalizeConfig(JSON.parse(row.config as string)),
      createdAt: row.created_at,
    })
  } catch (err) {
    await logError('flow', 'widget_config_load_error', err)
    return NextResponse.json({ error: 'Failed to fetch configuration' }, { status: 500 })
  }
}
