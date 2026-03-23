'use client'

import { motion } from 'motion/react'
import { ArrowRightLeft, Receipt, Zap, Globe, Percent, Clock, Info, ArrowRight, ArrowLeft, Loader2, Route } from 'lucide-react'
import type { SwapQuote } from '@/types'
import { FIAT_SYMBOLS } from '@/constants/tokens'
import { getChainName } from '@/services/bungee'

type QuoteReviewProps = {
  quote: SwapQuote
  onConfirm: () => void
  onBack: () => void
  isLoading: boolean
}

function Row({ label, value, accent, icon: Icon }: { label: string; value: string; accent?: boolean; icon?: React.ComponentType<{ className?: string; strokeWidth?: number }> }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[11px] text-[var(--text-muted)] font-medium inline-flex items-center gap-1.5">
        {Icon && <Icon className="w-3 h-3" strokeWidth={1.75} />}
        {label}
      </span>
      <span
        className={`text-[12px] font-[family-name:var(--font-ibm-plex-mono)] font-medium ${accent ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}
      >
        {value}
      </span>
    </div>
  )
}

export function QuoteReview({ quote, onConfirm, onBack, isLoading }: QuoteReviewProps) {
  const { params, tokenAmount, minTokenAmount, fees, exchangeRate, priceImpact, estimatedTime, routeName } = quote
  const symbol = FIAT_SYMBOLS[params.fiatCurrency]

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="space-y-4"
    >
      <div className="text-center space-y-1">
        <p className="text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-widest">
          You receive
        </p>
        <motion.p
          className="text-3xl font-bold text-[var(--text-primary)] font-[family-name:var(--font-ibm-plex-mono)] tracking-tight"
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 20 }}
        >
          {tokenAmount}
          <span className="text-base ml-1.5 text-[var(--accent)] font-sans font-semibold">
            {params.token.symbol}
          </span>
        </motion.p>
        <p className="text-[11px] text-[var(--text-muted)]">
          for {symbol}{params.fiatAmount} · {getChainName(params.token.chainId)}
        </p>
      </div>

      <div className="bg-[var(--surface-2)] rounded-2xl p-3 border border-[var(--border-light)]">
        <Row label="Exchange rate" value={exchangeRate} icon={ArrowRightLeft} />
        <div className="h-px bg-[var(--border-light)]" />
        <Row label="Onramp fee (Monerium)" value={fees.onramp} accent icon={Receipt} />
        <Row label="Bridge / swap fee" value={fees.bridgeSwap} icon={Zap} />
        <Row label="Network fee" value={fees.network} icon={Globe} />
        <div className="h-px bg-[var(--border-light)]" />
        <Row label="Total fees" value={`${fees.total} (${fees.totalPercent})`} icon={Receipt} />
        <Row label="Price impact" value={priceImpact} icon={Percent} />
        <Row label="Est. time" value={estimatedTime} icon={Clock} />
        {routeName && (
          <Row label="Route" value={routeName} icon={Route} />
        )}
        {minTokenAmount && minTokenAmount !== tokenAmount && (
          <Row label="Min. received" value={`${minTokenAmount} ${params.token.symbol}`} icon={Info} />
        )}
      </div>

      <div className="bg-[var(--accent-wash)] border border-[var(--accent)]/15 rounded-xl p-3">
        <p className="text-[11px] text-[var(--accent)] font-medium leading-relaxed inline-flex items-start gap-2">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" strokeWidth={2} />
          <span>
            0% onramp fee via Monerium. EUR converts 1:1 to EURe on-chain,
            then swaps to {params.token.symbol} via Bungee cross-chain routing.
          </span>
        </p>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={isLoading}
          className="btn-secondary flex-1 py-3 text-sm disabled:opacity-50 cursor-pointer inline-flex items-center justify-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isLoading}
          className="btn-primary flex-[2] py-3 text-sm disabled:opacity-50 cursor-pointer"
        >
          {isLoading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing...
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              Continue
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          )}
        </button>
      </div>
    </motion.div>
  )
}
