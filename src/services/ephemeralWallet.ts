import {
  createWalletClient,
  http,
  type Account,
  type Chain,
  type Transport,
  type WalletClient,
} from 'viem'
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts'
import { gnosis } from 'viem/chains'

type ViemWalletClient = WalletClient<Transport, Chain | undefined, Account>

const LS_KEY = 'tokenbuy_ephemeral_wallet'
const IDB_NAME = 'tokenbuy_keys'
const IDB_STORE = 'aes_keys'
const IDB_KEY_ID = 'ephemeral_aes'
const TTL_MS = 24 * 60 * 60 * 1000

// ---------------------------------------------------------------------------
// IndexedDB helpers for the non-extractable AES-GCM CryptoKey
// ---------------------------------------------------------------------------

function openKeyStore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function storeAesKey(key: CryptoKey): Promise<void> {
  const db = await openKeyStore()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).put(key, IDB_KEY_ID)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

async function loadAesKey(): Promise<CryptoKey | null> {
  const db = await openKeyStore()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly')
    const req = tx.objectStore(IDB_STORE).get(IDB_KEY_ID)
    req.onsuccess = () => { db.close(); resolve(req.result ?? null) }
    req.onerror = () => { db.close(); reject(req.error) }
  })
}

async function deleteAesKey(): Promise<void> {
  const db = await openKeyStore()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).delete(IDB_KEY_ID)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

// ---------------------------------------------------------------------------
// AES-GCM encrypt / decrypt using the non-extractable CryptoKey
// ---------------------------------------------------------------------------

async function getOrCreateAesKey(): Promise<CryptoKey> {
  const existing = await loadAesKey()
  if (existing) return existing

  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false, // non-extractable
    ['encrypt', 'decrypt'],
  )
  await storeAesKey(key)
  return key
}

async function encryptPrivateKey(
  privateKey: string,
  aesKey: CryptoKey,
): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(privateKey)

  const ciphertextBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    encoded,
  )

  return {
    ciphertext: bufferToBase64(ciphertextBuf),
    iv: bufferToBase64(iv.buffer),
  }
}

async function decryptPrivateKey(
  ciphertext: string,
  iv: string,
  aesKey: CryptoKey,
): Promise<string> {
  const ciphertextBuf = base64ToBuffer(ciphertext)
  const ivBuf = new Uint8Array(base64ToBuffer(iv))

  const plainBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBuf },
    aesKey,
    ciphertextBuf,
  )

  return new TextDecoder().decode(plainBuf)
}

function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

// ---------------------------------------------------------------------------
// localStorage record
// ---------------------------------------------------------------------------

type StoredWalletRecord = {
  ciphertext: string
  iv: string
  address: string
  recipientAddress: string
  email: string
  flowId: string
  createdAt: number
}

function saveRecord(record: StoredWalletRecord): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(record))
  } catch { /* storage full or blocked */ }
}

function loadRecord(): StoredWalletRecord | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null

    const record = JSON.parse(raw) as StoredWalletRecord
    if (Date.now() - record.createdAt > TTL_MS) {
      localStorage.removeItem(LS_KEY)
      return null
    }
    return record
  } catch {
    return null
  }
}

function clearRecord(): void {
  try {
    localStorage.removeItem(LS_KEY)
  } catch { /* noop */ }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type EphemeralWallet = {
  address: `0x${string}`
  walletClient: ViemWalletClient
  flowId: string
}

function buildFlowId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function buildWalletClient(privateKey: `0x${string}`): ViemWalletClient {
  const account = privateKeyToAccount(privateKey)
  return createWalletClient({
    account,
    chain: gnosis,
    transport: http(),
  }) as ViemWalletClient
}

/**
 * Generate a fresh ephemeral wallet, encrypt it locally, and escrow it
 * on the server. Returns the wallet ready for signing.
 */
export async function generateEphemeralWallet(params: {
  recipientAddress: string
  email: string
}): Promise<EphemeralWallet> {
  const privateKey = generatePrivateKey()
  const account = privateKeyToAccount(privateKey)
  const flowId = buildFlowId()

  const aesKey = await getOrCreateAesKey()
  const { ciphertext, iv } = await encryptPrivateKey(privateKey, aesKey)

  saveRecord({
    ciphertext,
    iv,
    address: account.address,
    recipientAddress: params.recipientAddress,
    email: params.email,
    flowId,
    createdAt: Date.now(),
  })

  await escrowStore({
    privateKey,
    email: params.email,
    recipientAddress: params.recipientAddress,
    flowId,
  })

  return {
    address: account.address as `0x${string}`,
    walletClient: buildWalletClient(privateKey),
    flowId,
  }
}

/**
 * Attempt to restore a previously-created ephemeral wallet from
 * encrypted localStorage + IndexedDB AES key.
 */
export async function loadEphemeralWallet(): Promise<EphemeralWallet | null> {
  const record = loadRecord()
  if (!record) return null

  try {
    const aesKey = await loadAesKey()
    if (!aesKey) return null

    const privateKey = await decryptPrivateKey(
      record.ciphertext,
      record.iv,
      aesKey,
    ) as `0x${string}`

    return {
      address: record.address as `0x${string}`,
      walletClient: buildWalletClient(privateKey),
      flowId: record.flowId,
    }
  } catch {
    return null
  }
}

/**
 * Returns the stored metadata without decrypting the key.
 * Useful for detecting a pending flow on page load.
 */
export function getStoredWalletMeta(): {
  address: string
  email: string
  recipientAddress: string
  flowId: string
  createdAt: number
} | null {
  const record = loadRecord()
  if (!record) return null
  return {
    address: record.address,
    email: record.email,
    recipientAddress: record.recipientAddress,
    flowId: record.flowId,
    createdAt: record.createdAt,
  }
}

/**
 * Wipe the ephemeral key from all local stores and the server escrow.
 */
export async function deleteEphemeralWallet(flowId?: string): Promise<void> {
  const record = loadRecord()
  const targetFlowId = flowId ?? record?.flowId

  clearRecord()

  try { await deleteAesKey() } catch { /* best effort */ }

  if (targetFlowId) {
    try { await escrowCleanup(targetFlowId) } catch { /* best effort */ }
  }
}

/**
 * Recover an ephemeral wallet from the server escrow using email + OTP.
 */
export async function recoverEphemeralWallet(params: {
  email: string
  otp: string
}): Promise<EphemeralWallet> {
  const res = await fetch('/api/escrow/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: params.email, otp: params.otp }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Recovery verification failed')
  }

  const { privateKey, flowId, recipientAddress, email } = await res.json()

  const aesKey = await getOrCreateAesKey()
  const { ciphertext, iv } = await encryptPrivateKey(privateKey, aesKey)
  const account = privateKeyToAccount(privateKey as `0x${string}`)

  saveRecord({
    ciphertext,
    iv,
    address: account.address,
    recipientAddress,
    email,
    flowId,
    createdAt: Date.now(),
  })

  return {
    address: account.address as `0x${string}`,
    walletClient: buildWalletClient(privateKey as `0x${string}`),
    flowId,
  }
}

/**
 * Request an OTP for key recovery.
 */
export async function requestRecoveryOtp(email: string): Promise<void> {
  const res = await fetch('/api/escrow/recover', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Failed to send recovery code')
  }
}

// ---------------------------------------------------------------------------
// Server escrow HTTP helpers
// ---------------------------------------------------------------------------

async function escrowStore(params: {
  privateKey: string
  email: string
  recipientAddress: string
  flowId: string
}): Promise<void> {
  const res = await fetch('/api/escrow/store', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })

  if (!res.ok) {
    console.error('[ephemeralWallet] escrow store failed:', res.status)
  }
}

async function escrowCleanup(flowId: string): Promise<void> {
  const res = await fetch('/api/escrow/cleanup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flowId }),
  })

  if (!res.ok) {
    console.error('[ephemeralWallet] escrow cleanup failed:', res.status)
  }
}
