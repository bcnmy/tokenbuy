import type { Token, FiatCurrency } from '@/types'

export const DEFAULT_TOKEN: Token = {
  symbol: 'ETH',
  name: 'Ether',
  decimals: 18,
  chainId: 1,
  address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  icon: 'https://media.socket.tech/networks/ethereum.svg',
}

export const SUPPORTED_FIAT: readonly FiatCurrency[] = ['EUR', 'GBP'] as const

export const FIAT_SYMBOLS: Record<FiatCurrency, string> = {
  EUR: '€',
  GBP: '£',
}

export const GBP_TO_EUR = 1.17
