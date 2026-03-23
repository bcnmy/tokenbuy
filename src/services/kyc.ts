import type { KycStatus } from '@/types'

export async function getKycStatus(walletAddress: string): Promise<KycStatus> {
  const res = await fetch(
    `/api/kyc/status?wallet=${encodeURIComponent(walletAddress)}`,
  )
  if (!res.ok) throw new Error('Failed to check KYC status')
  const data = await res.json()
  return data.status
}

export async function getKycAccessToken(walletAddress: string): Promise<string> {
  const res = await fetch('/api/kyc/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Failed to initialize verification')
  }
  const data = await res.json()
  return data.token
}
