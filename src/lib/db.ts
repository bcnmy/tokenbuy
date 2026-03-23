import { createClient, type Client, type InValue } from '@libsql/client'

let client: Client | null = null
let migrated = false

export function getDb(): Client {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL
    if (!url) throw new Error('TURSO_DATABASE_URL is not set')

    client = createClient({
      url,
      authToken: process.env.TURSO_AUTH_TOKEN,
    })
  }
  return client
}

export async function ensureMigrations() {
  if (migrated) return
  const db = getDb()

  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS widget_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      integrator_key TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      config TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS kyc_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wallet_address TEXT UNIQUE NOT NULL,
      applicant_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      review_answer TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS monerium_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wallet_address TEXT UNIQUE NOT NULL,
      email TEXT,
      profile_id TEXT,
      profile_state TEXT NOT NULL DEFAULT 'created',
      access_token TEXT,
      refresh_token TEXT,
      token_expires_at TEXT,
      iban TEXT,
      bic TEXT,
      chain TEXT NOT NULL DEFAULT 'gnosis',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS monerium_auth_state (
      state TEXT PRIMARY KEY,
      code_verifier TEXT NOT NULL,
      wallet_address TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS flow_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level TEXT NOT NULL DEFAULT 'info',
      category TEXT NOT NULL DEFAULT 'flow',
      event TEXT NOT NULL,
      session_id TEXT,
      wallet_address TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_flow_logs_session ON flow_logs (session_id);
    CREATE INDEX IF NOT EXISTS idx_flow_logs_wallet ON flow_logs (wallet_address);
    CREATE INDEX IF NOT EXISTS idx_flow_logs_category ON flow_logs (category);
    CREATE INDEX IF NOT EXISTS idx_flow_logs_created ON flow_logs (created_at);
  `)

  migrated = true
}

export type { Client, InValue }
