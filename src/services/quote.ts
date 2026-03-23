import type { SwapQuoteParams, SwapQuote, QuoteEstimate, FiatCurrency, Token } from '@/types'
import { getBungeeQuote, weiToTokenAmount, type BungeeQuoteResult } from './bungee'
import { GBP_TO_EUR } from '@/constants/tokens'

function fiatToEur(amount: number, currency: FiatCurrency): number {
  return currency === 'GBP' ? amount * GBP_TO_EUR : amount
}

function formatUsd(usd: number): string {
  return `$${usd.toFixed(2)}`
}

function buildExchangeRate(eurAmount: number, tokenAmount: string, tokenSymbol: string): string {
  const tokens = parseFloat(tokenAmount)
  if (!tokens || !eurAmount) return `1 EUR ≈ ? ${tokenSymbol}`
  const rate = tokens / eurAmount
  const dp = rate < 0.001 ? 8 : rate < 1 ? 6 : rate < 100 ? 4 : 2
  return `1 EUR ≈ ${rate.toFixed(dp)} ${tokenSymbol}`
}

function quoteResultToEstimate(result: BungeeQuoteResult, eurAmount: number): QuoteEstimate {
  const tokenAmount = weiToTokenAmount(result.outputAmount, result.outputToken.decimals)
  const totalFeeUsd = result.inputValueUsd - result.outputValueUsd
  return {
    tokenAmount,
    exchangeRate: buildExchangeRate(eurAmount, tokenAmount, result.outputToken.symbol),
    totalFee: formatUsd(Math.max(0, totalFeeUsd)),
  }
}

export async function fetchEstimate(
  params: { fiatCurrency: FiatCurrency; fiatAmount: string; token: Token },
  signal?: AbortSignal,
): Promise<QuoteEstimate> {
  const fiatAmount = parseFloat(params.fiatAmount)
  if (isNaN(fiatAmount) || fiatAmount <= 0) throw new Error('Invalid amount')

  const eurAmount = fiatToEur(fiatAmount, params.fiatCurrency)

  const result = await getBungeeQuote({
    eurAmount,
    destinationChainId: params.token.chainId,
    outputToken: params.token.address,
  }, signal)

  return quoteResultToEstimate(result, eurAmount)
}

export async function fetchQuote(params: SwapQuoteParams): Promise<SwapQuote> {
  const fiatAmount = parseFloat(params.fiatAmount)
  if (isNaN(fiatAmount) || fiatAmount <= 0) throw new Error('Invalid fiat amount')

  const eurAmount = fiatToEur(fiatAmount, params.fiatCurrency)

  const result = await getBungeeQuote({
    eurAmount,
    destinationChainId: params.token.chainId,
    outputToken: params.token.address,
    receiverAddress: params.recipientAddress,
  })

  const tokenAmount = weiToTokenAmount(result.outputAmount, result.outputToken.decimals)
  const minTokenAmount = weiToTokenAmount(result.minOutputAmount, result.outputToken.decimals)
  const totalFeeUsd = result.inputValueUsd - result.outputValueUsd
  const totalFeePercent = result.inputValueUsd > 0
    ? (totalFeeUsd / result.inputValueUsd) * 100
    : 0

  return {
    id: result.quoteId,
    params,
    tokenAmount,
    minTokenAmount,
    exchangeRate: buildExchangeRate(eurAmount, tokenAmount, result.outputToken.symbol),
    priceImpact: `${Math.max(0, totalFeePercent).toFixed(2)}%`,
    fees: {
      onramp: '$0.00',
      bridgeSwap: formatUsd(result.routeFeeUsd),
      network: formatUsd(result.gasFeeUsd),
      total: formatUsd(Math.max(0, totalFeeUsd)),
      totalPercent: `${Math.max(0, totalFeePercent).toFixed(2)}%`,
    },
    estimatedTime: result.estimatedTime < 60
      ? `~${result.estimatedTime}s`
      : `~${Math.ceil(result.estimatedTime / 60)} min`,
    expiresAt: result.quoteExpiry * 1000,
    routeName: result.routeName,
  }
}
