import { createPublicClient, http, type Address } from 'viem'
import { gnosis } from 'viem/chains'
import type { PaymentInfo, FiatCurrency, Transaction, Token } from '@/types'
import { EURE_GNOSIS } from './bungee'

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
  signerAddress?: string
  tokenSymbol: string
  flowId?: string
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
  options?: { email?: string; signature?: string },
): Promise<{ authUrl: string | null; iban?: string; bic?: string }> {
  const res = await fetch('/api/monerium/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      walletAddress,
      email: options?.email,
      signature: options?.signature,
    }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Failed to start Monerium authorization')
  }

  const data: AuthResponse = await res.json()

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
 * Logs the user out from Monerium by clearing the server-side profile
 * and any local flow state.
 */
export async function logoutMonerium(walletAddress: string): Promise<void> {
  await fetch('/api/monerium/logout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress }),
  })
  clearFlowState()
}

// --- On-chain EURe balance watching ---

const EURE_MONERIUM_GNOSIS = '0x420CA0f9B9b604cE0fd9C18EF134C705e5Fa3430' as Address

const gnosisClient = createPublicClient({
  chain: gnosis,
  transport: http(),
})

const erc20BalanceOfAbi = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const

async function getEureBalance(address: Address): Promise<bigint> {
  return gnosisClient.readContract({
    address: EURE_MONERIUM_GNOSIS,
    abi: erc20BalanceOfAbi,
    functionName: 'balanceOf',
    args: [address],
  })
}

function formatEureWei(wei: bigint): string {
  const divisor = BigInt(10 ** EURE_GNOSIS.decimals)
  const whole = wei / divisor
  const remainder = wei % divisor
  if (remainder === BigInt(0)) return whole.toString()
  const decimals = remainder.toString().padStart(EURE_GNOSIS.decimals, '0')
  const trimmed = decimals.slice(0, 2).replace(/0+$/, '')
  return trimmed ? `${whole}.${trimmed}` : whole.toString()
}

const POLL_INTERVAL_MS = 5_000
const MAX_POLL_DURATION_MS = 60 * 60 * 1000

const EURE_TOKEN: Token = {
  symbol: EURE_GNOSIS.symbol,
  name: EURE_GNOSIS.name,
  decimals: EURE_GNOSIS.decimals,
  chainId: EURE_GNOSIS.chainId,
  address: EURE_GNOSIS.address,
  icon: null,
}

export type EureDepositResult = {
  transaction: Transaction
  depositedWei: bigint
}

/**
 * Watches the EURe balance of `walletAddress` on Gnosis Chain.
 * Resolves when the balance increases from its value at call time,
 * indicating Monerium has processed the bank transfer and minted EURe.
 */
export async function watchForEureDeposit(params: {
  walletAddress: string
  onStatusChange: (status: Transaction['status']) => void
  signal?: AbortSignal
}): Promise<EureDepositResult> {
  const address = params.walletAddress as Address
  const txId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  const initialBalance = await getEureBalance(address)

  return new Promise<EureDepositResult>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const startTime = Date.now()

    function cleanup() {
      if (timer !== null) clearTimeout(timer)
    }

    function onAbort() {
      cleanup()
      reject(new DOMException('Aborted', 'AbortError'))
    }

    if (params.signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }

    params.signal?.addEventListener('abort', onAbort, { once: true })

    async function poll() {
      if (params.signal?.aborted) return

      if (Date.now() - startTime > MAX_POLL_DURATION_MS) {
        cleanup()
        params.signal?.removeEventListener('abort', onAbort)
        reject(new Error('Timed out waiting for EURe deposit. The bank transfer may still be processing — please check back later.'))
        return
      }

      try {
        const currentBalance = await getEureBalance(address)

        if (currentBalance > initialBalance) {
          cleanup()
          params.signal?.removeEventListener('abort', onAbort)

          const deposited = currentBalance - initialBalance
          params.onStatusChange('payment_received')

          resolve({
            depositedWei: deposited,
            transaction: {
              id: txId,
              status: 'payment_received',
              txHash: null,
              tokenAmount: formatEureWei(deposited),
              token: EURE_TOKEN,
              createdAt: Date.now(),
            },
          })
          return
        }
      } catch {
        // Individual poll errors are non-fatal; retry on next tick
      }

      timer = setTimeout(poll, POLL_INTERVAL_MS)
    }

    timer = setTimeout(poll, POLL_INTERVAL_MS)
  })
}
