import type { PaymentInfo, FiatCurrency, Transaction, Hex, Token } from '@/types'

type IbanResponse = {
  iban: string | null
  bic: string | null
  beneficiary?: string
  profileState: string
  ready: boolean
  needsAuth: boolean
  error?: string
}

type AuthResponse = {
  authUrl?: string
  alreadyOnboarded?: boolean
  iban?: string
  bic?: string
  error?: string
}

const FLOW_STATE_KEY = 'tokenbuy_monerium_flow'

export type SavedFlowState = {
  fiatAmount: string
  fiatCurrency: FiatCurrency
  quoteId: string
  recipientAddress: string
  tokenSymbol: string
  savedAt: number
}

export function saveFlowStateForRedirect(state: SavedFlowState) {
  try {
    localStorage.setItem(FLOW_STATE_KEY, JSON.stringify(state))
  } catch { /* noop */ }
}

export function loadFlowStateAfterRedirect(): SavedFlowState | null {
  try {
    const raw = localStorage.getItem(FLOW_STATE_KEY)
    if (!raw) return null
    const state = JSON.parse(raw) as SavedFlowState
    if (Date.now() - state.savedAt > 15 * 60 * 1000) {
      localStorage.removeItem(FLOW_STATE_KEY)
      return null
    }
    return state
  } catch {
    return null
  }
}

export function clearFlowState() {
  try {
    localStorage.removeItem(FLOW_STATE_KEY)
  } catch { /* noop */ }
}

/**
 * Starts the Monerium authorization flow.
 * Returns an authUrl if the user needs to be redirected,
 * or null if they already have an IBAN.
 */
export async function initiateMoneriumAuth(
  walletAddress: string,
  email?: string,
): Promise<{ authUrl: string | null; iban?: string; bic?: string }> {
  const res = await fetch('/api/monerium/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress, email }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Failed to start Monerium authorization')
  }

  const data: AuthResponse = await res.json()

  if (data.alreadyOnboarded && data.iban) {
    return { authUrl: null, iban: data.iban, bic: data.bic }
  }

  if (!data.authUrl) {
    throw new Error('No authorization URL received')
  }

  return { authUrl: data.authUrl }
}

/**
 * Fetches the IBAN for a wallet that has completed Monerium auth.
 */
export async function fetchIban(walletAddress: string): Promise<IbanResponse> {
  const res = await fetch(
    `/api/monerium/iban?wallet=${encodeURIComponent(walletAddress)}`,
  )
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Failed to fetch IBAN')
  }
  return res.json()
}

/**
 * Builds PaymentInfo from stored IBAN data.
 */
export function buildPaymentInfo(params: {
  iban: string
  bic: string
  beneficiary?: string
  amount: string
  currency: FiatCurrency
  quoteId: string
}): PaymentInfo {
  return {
    iban: params.iban,
    bic: params.bic,
    bankName: 'Monerium',
    reference: `TB-${params.quoteId.slice(-8).toUpperCase()}`,
    amount: params.amount,
    currency: params.currency,
    beneficiary: params.beneficiary || 'Monerium ehf.',
  }
}

/**
 * Payment flow monitoring.
 *
 * In production this would listen to Monerium order webhooks
 * and onchain EURe Transfer events. For now we simulate the
 * progression after showing the real IBAN to the user.
 */
export async function simulatePaymentFlow(params: {
  quoteId: string
  token: Token
  tokenAmount: string
  onStatusChange: (status: Transaction['status']) => void
}): Promise<Transaction> {
  const txId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  const steps: Array<{ status: Transaction['status']; delay: number }> = [
    { status: 'payment_received', delay: 3000 },
    { status: 'converting', delay: 4000 },
    { status: 'sending', delay: 3000 },
    { status: 'complete', delay: 2000 },
  ]

  let currentStatus: Transaction['status'] = 'awaiting_payment'

  for (const step of steps) {
    await new Promise((resolve) => setTimeout(resolve, step.delay))
    currentStatus = step.status
    params.onStatusChange(currentStatus)
  }

  const mockTxHash: Hex =
    `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}` as Hex

  return {
    id: txId,
    status: 'complete',
    txHash: mockTxHash,
    tokenAmount: params.tokenAmount,
    token: params.token,
    createdAt: Date.now(),
  }
}
