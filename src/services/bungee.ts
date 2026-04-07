import type { Token, Chain } from '@/types'

const BUNGEE_API = 'https://public-backend.bungee.exchange'

export const EURE_GNOSIS = {
  chainId: 100,
  address: '0x420CA0f9B9b604cE0fd9C18EF134C705e5Fa3430',
  symbol: 'EURe',
  name: 'Monerium EUR emoney',
  decimals: 18,
} as const

const PLACEHOLDER_RECEIVER = '0x000000000000000000000000000000000000dEaD'

const CHAIN_COLORS: Record<number, string> = {
  1: '#627EEA',
  10: '#FF0420',
  100: '#04795B',
  137: '#8247E5',
  324: '#8C8DFC',
  8453: '#0052FF',
  42161: '#28A0F0',
  43114: '#E84142',
  56: '#F0B90B',
  250: '#1969FF',
  59144: '#121212',
  534352: '#FFEEDA',
  1101: '#8247E5',
  34443: '#000000',
  7777777: '#5B5BD6',
}

// --- Caching ---

type CacheEntry<T> = { data: T; expiresAt: number }

let chainsCache: CacheEntry<Chain[]> | null = null
let tokensCache: CacheEntry<Token[]> | null = null

const CHAINS_TTL = 10 * 60 * 1000 // 10 min
const TOKENS_TTL = 5 * 60 * 1000 // 5 min

function isFresh<T>(entry: CacheEntry<T> | null): entry is CacheEntry<T> {
  return entry !== null && Date.now() < entry.expiresAt
}

// --- API Helpers ---

async function bungeeGet<T>(path: string, params?: Record<string, string>, signal?: AbortSignal): Promise<T> {
  const url = new URL(path, BUNGEE_API)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') url.searchParams.set(k, v)
    }
  }

  const res = await fetch(url.toString(), { signal })
  if (!res.ok) {
    throw new Error(`Bungee API error: ${res.status} ${res.statusText}`)
  }

  const json = await res.json()
  if (!json.success) {
    throw new Error(json.message ?? 'Bungee API returned an error')
  }

  return json.result
}

// --- Supported Chains ---

type BungeeChainRaw = {
  chainId: number
  name: string
  icon: string
  currency: {
    address: string
    name: string
    symbol: string
    decimals: number
    icon: string
  }
  sendingEnabled: boolean
  receivingEnabled: boolean
}

export async function getSupportedChains(signal?: AbortSignal): Promise<Chain[]> {
  if (isFresh(chainsCache)) return chainsCache.data

  const raw = await bungeeGet<BungeeChainRaw[]>('/api/v1/supported-chains', undefined, signal)

  const chains: Chain[] = raw.map((c) => ({
    chainId: c.chainId,
    name: c.name,
    icon: c.icon,
    color: CHAIN_COLORS[c.chainId] ?? '#888888',
    currency: {
      symbol: c.currency.symbol,
      name: c.currency.name,
      decimals: c.currency.decimals,
      address: c.currency.address,
    },
    receivingEnabled: c.receivingEnabled,
    sendingEnabled: c.sendingEnabled,
  }))

  chainsCache = { data: chains, expiresAt: Date.now() + CHAINS_TTL }
  return chains
}

export async function getReceivableChains(signal?: AbortSignal): Promise<Chain[]> {
  const all = await getSupportedChains(signal)
  return all.filter((c) => c.receivingEnabled)
}

// --- Token List ---

type BungeeTokenRaw = {
  chainId: number
  address: string
  name: string
  symbol: string
  decimals: number
  logoURI: string | null
  isVerified: boolean
}

export async function getTokenList(signal?: AbortSignal): Promise<Token[]> {
  if (isFresh(tokensCache)) return tokensCache.data

  const chains = await getReceivableChains(signal)
  const chainIds = chains.map((c) => c.chainId).join(',')

  const raw = await bungeeGet<Record<string, BungeeTokenRaw[]>>(
    '/api/v1/tokens/list',
    { chainIds, list: 'trending' },
    signal,
  )

  const tokens: Token[] = []
  for (const [, chainTokens] of Object.entries(raw)) {
    for (const t of chainTokens) {
      tokens.push({
        symbol: t.symbol,
        name: t.name,
        decimals: t.decimals,
        chainId: t.chainId,
        address: t.address,
        icon: t.logoURI,
        isVerified: t.isVerified,
      })
    }
  }

  tokensCache = { data: tokens, expiresAt: Date.now() + TOKENS_TTL }
  return tokens
}

// --- Quote ---

type BungeeQuoteRaw = {
  originChainId: number
  destinationChainId: number
  input: {
    token: BungeeTokenRaw
    amount: string
    priceInUsd: number
    valueInUsd: number
  }
  autoRoute: {
    output: {
      token: BungeeTokenRaw
      amount: string
      minAmountOut: string
      priceInUsd: number
      valueInUsd: number
      effectiveReceivedInUsd: number
    }
    quoteId: string
    quoteExpiry: number
    estimatedTime: number
    gasFee: {
      estimatedFee: string
      feeInUsd: number
    } | null
    routeDetails: {
      name: string
      logoURI: string
      routeFee: {
        amount: string
        feeInUsd: number
      } | null
    }
  } | null
  manualRoutes: Array<{
    output: {
      token: BungeeTokenRaw
      amount: string
      minAmountOut: string
      priceInUsd: number
      valueInUsd: number
      effectiveReceivedInUsd: number
    }
    quoteId: string
    quoteExpiry: number
    estimatedTime: number
    gasFee: {
      estimatedFee: string
      feeInUsd: number
    } | null
    routeDetails: {
      name: string
      logoURI: string
      routeFee: {
        amount: string
        feeInUsd: number
      } | null
    }
  }>
}

export type BungeeQuoteResult = {
  quoteId: string
  outputAmount: string
  minOutputAmount: string
  outputToken: Token
  inputValueUsd: number
  outputValueUsd: number
  gasFeeUsd: number
  routeFeeUsd: number
  estimatedTime: number
  routeName: string
  quoteExpiry: number
}

export function eureToWei(eurAmount: number): string {
  if (eurAmount <= 0) return '0'
  const wei = BigInt(Math.round(eurAmount * 1e6)) * BigInt(1e12)
  return wei.toString()
}

export function weiToTokenAmount(weiStr: string, decimals: number): string {
  if (!weiStr || weiStr === '0') return '0'
  const wei = BigInt(weiStr)
  const divisor = BigInt(10 ** decimals)
  const whole = wei / divisor
  const remainder = wei % divisor
  const ZERO = BigInt(0)

  if (remainder === ZERO) return whole.toString()

  const displayDecimals = Math.min(decimals, 8)
  const remainderStr = remainder.toString().padStart(decimals, '0')
  const trimmed = remainderStr.slice(0, displayDecimals).replace(/0+$/, '')

  return trimmed ? `${whole}.${trimmed}` : whole.toString()
}

export async function getBungeeQuote(params: {
  eurAmount: number
  destinationChainId: number
  outputToken: string
  receiverAddress?: string
  slippage?: string
}, signal?: AbortSignal): Promise<BungeeQuoteResult> {
  const inputAmount = eureToWei(params.eurAmount)
  if (inputAmount === '0') throw new Error('Amount too small')

  const receiver = params.receiverAddress ?? PLACEHOLDER_RECEIVER

  const raw = await bungeeGet<BungeeQuoteRaw>(
    '/api/v1/bungee/quote',
    {
      originChainId: EURE_GNOSIS.chainId.toString(),
      destinationChainId: params.destinationChainId.toString(),
      inputToken: EURE_GNOSIS.address,
      outputToken: params.outputToken,
      inputAmount,
      receiverAddress: receiver,
      userAddress: receiver,
      slippage: params.slippage ?? '0.5',
      enableManual: 'true',
    },
    signal,
  )

  const route = raw.autoRoute ?? raw.manualRoutes[0]
  if (!route) {
    throw new Error('No route found for this swap. Try a different token or amount.')
  }

  return {
    quoteId: route.quoteId,
    outputAmount: route.output.amount,
    minOutputAmount: route.output.minAmountOut,
    outputToken: {
      symbol: route.output.token.symbol,
      name: route.output.token.name,
      decimals: route.output.token.decimals,
      chainId: route.output.token.chainId,
      address: route.output.token.address,
      icon: route.output.token.logoURI,
    },
    inputValueUsd: raw.input.valueInUsd,
    outputValueUsd: route.output.effectiveReceivedInUsd,
    gasFeeUsd: route.gasFee?.feeInUsd ?? 0,
    routeFeeUsd: route.routeDetails.routeFee?.feeInUsd ?? 0,
    estimatedTime: route.estimatedTime,
    routeName: route.routeDetails.name,
    quoteExpiry: route.quoteExpiry,
  }
}

// --- Manual Route Quote (for build-tx) ---

export async function getManualRouteQuote(params: {
  eurAmount: number
  destinationChainId: number
  outputToken: string
  receiverAddress: string
  userAddress?: string
  slippage?: string
}, signal?: AbortSignal): Promise<BungeeQuoteResult> {
  const inputAmount = eureToWei(params.eurAmount)
  if (inputAmount === '0') throw new Error('Amount too small')

  const raw = await bungeeGet<BungeeQuoteRaw>(
    '/api/v1/bungee/quote',
    {
      originChainId: EURE_GNOSIS.chainId.toString(),
      destinationChainId: params.destinationChainId.toString(),
      inputToken: EURE_GNOSIS.address,
      outputToken: params.outputToken,
      inputAmount,
      receiverAddress: params.receiverAddress,
      userAddress: params.userAddress ?? params.receiverAddress,
      slippage: params.slippage ?? '0.5',
      enableManual: 'true',
    },
    signal,
  )

  const route = raw.manualRoutes[0]
  if (!route) {
    throw new Error('No manual route found for this swap. Try a different token or amount.')
  }

  return {
    quoteId: route.quoteId,
    outputAmount: route.output.amount,
    minOutputAmount: route.output.minAmountOut,
    outputToken: {
      symbol: route.output.token.symbol,
      name: route.output.token.name,
      decimals: route.output.token.decimals,
      chainId: route.output.token.chainId,
      address: route.output.token.address,
      icon: route.output.token.logoURI,
    },
    inputValueUsd: raw.input.valueInUsd,
    outputValueUsd: route.output.effectiveReceivedInUsd,
    gasFeeUsd: route.gasFee?.feeInUsd ?? 0,
    routeFeeUsd: route.routeDetails.routeFee?.feeInUsd ?? 0,
    estimatedTime: route.estimatedTime,
    routeName: route.routeDetails.name,
    quoteExpiry: route.quoteExpiry,
  }
}

// --- Build Transaction ---

export type BungeeBuildTxResult = {
  txData: {
    data: string
    to: string
    chainId: number
    value: string
  }
  approvalData: {
    spenderAddress: string
    amount: string
    tokenAddress: string
    userAddress: string
  } | null
  userOp: string
}

export async function buildBungeeTx(quoteId: string, signal?: AbortSignal): Promise<BungeeBuildTxResult> {
  return bungeeGet<BungeeBuildTxResult>(
    '/api/v1/bungee/build-tx',
    { quoteId },
    signal,
  )
}

// --- Chain name lookup ---

const chainNameOverrides: Record<number, string> = {}

export function registerChains(chains: Chain[]) {
  for (const c of chains) {
    chainNameOverrides[c.chainId] = c.name
  }
}

export function getChainName(chainId: number): string {
  return chainNameOverrides[chainId] ?? `Chain ${chainId}`
}

export function getChainColor(chainId: number): string {
  return CHAIN_COLORS[chainId] ?? '#888888'
}
