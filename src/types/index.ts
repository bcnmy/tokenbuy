export type Hex = `0x${string}`

export type FiatCurrency = 'EUR' | 'GBP'

export type Token = {
  readonly symbol: string
  readonly name: string
  readonly decimals: number
  readonly chainId: number
  readonly address: string
  readonly icon: string | null
  readonly isVerified?: boolean
}

export type Chain = {
  readonly chainId: number
  readonly name: string
  readonly icon: string
  readonly color: string
  readonly currency: {
    readonly symbol: string
    readonly name: string
    readonly decimals: number
    readonly address: string
  }
  readonly receivingEnabled: boolean
  readonly sendingEnabled: boolean
}

export type SwapQuoteParams = {
  readonly fiatCurrency: FiatCurrency
  readonly fiatAmount: string
  readonly token: Token
  readonly recipientAddress: Hex
}

export type SwapQuote = {
  readonly id: string
  readonly params: SwapQuoteParams
  readonly tokenAmount: string
  readonly minTokenAmount: string
  readonly exchangeRate: string
  readonly priceImpact: string
  readonly fees: {
    readonly onramp: string
    readonly bridgeSwap: string
    readonly network: string
    readonly total: string
    readonly totalPercent: string
  }
  readonly estimatedTime: string
  readonly expiresAt: number
  readonly routeName: string | null
}

export type KycStatus = 'not_started' | 'pending' | 'approved' | 'rejected'

export type KycSession = {
  readonly applicantId: string
  readonly status: KycStatus
  readonly provider: 'sumsub'
}

export type PaymentInfo = {
  readonly iban: string
  readonly bic: string
  readonly bankName: string
  readonly reference: string
  readonly amount: string
  readonly currency: FiatCurrency
  readonly beneficiary: string
}

export type TransactionStatus =
  | 'awaiting_payment'
  | 'payment_received'
  | 'converting'
  | 'sending'
  | 'complete'
  | 'failed'

export type Transaction = {
  readonly id: string
  readonly status: TransactionStatus
  readonly txHash: Hex | null
  readonly tokenAmount: string
  readonly token: Token
  readonly createdAt: number
}

export type QuoteEstimate = {
  readonly tokenAmount: string
  readonly exchangeRate: string
  readonly totalFee: string
}

export type FlowStep =
  | 'input'
  | 'quote'
  | 'payment'
  | 'processing'
  | 'complete'

export type InputMode = 'connect_wallet' | 'paste_address'
