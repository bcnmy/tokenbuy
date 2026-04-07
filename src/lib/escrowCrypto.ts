import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

function getEncryptionKey(): Buffer {
  const hex = process.env.ESCROW_ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error(
      'ESCROW_ENCRYPTION_KEY must be a 64-char hex string (32 bytes). ' +
      'Generate one with: openssl rand -hex 32',
    )
  }
  return Buffer.from(hex, 'hex')
}

export function encryptForStorage(plaintext: string): { ciphertext: string; iv: string } {
  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
    cipher.getAuthTag(),
  ])

  return {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('base64'),
  }
}

export function decryptFromStorage(ciphertext: string, iv: string): string {
  const key = getEncryptionKey()
  const ivBuf = Buffer.from(iv, 'base64')
  const data = Buffer.from(ciphertext, 'base64')

  const authTag = data.subarray(data.length - AUTH_TAG_LENGTH)
  const encrypted = data.subarray(0, data.length - AUTH_TAG_LENGTH)

  const decipher = createDecipheriv(ALGORITHM, key, ivBuf, { authTagLength: AUTH_TAG_LENGTH })
  decipher.setAuthTag(authTag)

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString('utf8')
}
