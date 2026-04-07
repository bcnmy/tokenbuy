'use client'

import { motion } from 'motion/react'
import { CircleCheck, ExternalLink, RotateCcw, Hash } from 'lucide-react'
import { useWidgetTheme } from './WidgetThemeProvider'
import type { Transaction } from '@/types'
import { getChainName } from '@/services/bungee'

type CompleteViewProps = {
  transaction: Transaction
  onNewSwap: () => void
}

export function CompleteView({ transaction, onNewSwap }: CompleteViewProps) {
  const theme = useWidgetTheme()
  const explorerUrl = transaction.txHash
    ? getExplorerUrl(transaction.token.chainId, transaction.txHash)
    : null

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className="space-y-4 py-1"
    >
      <div className="text-center space-y-2">
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 180, damping: 14 }}
          className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--accent-tertiary-wash)]"
          style={{ boxShadow: '0 4px 24px rgba(92, 201, 184, 0.15)' }}
        >
          <CircleCheck className="w-8 h-8 text-[var(--accent-tertiary)]" strokeWidth={1.75} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-1"
        >
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">
            {theme?.successTitle || 'Tokens Delivered'}
          </h3>
          <p className="text-2xl font-bold font-[family-name:var(--font-ibm-plex-mono)] text-[var(--accent)]">
            {transaction.tokenAmount}
            <span className="text-sm ml-1.5 font-sans font-semibold">{transaction.token.symbol}</span>
          </p>
          <p className="text-[11px] text-[var(--text-muted)]">
            on {getChainName(transaction.token.chainId)}
          </p>
        </motion.div>
      </div>

      {transaction.txHash && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-[var(--surface-2)] rounded-xl p-3 border border-[var(--border-light)]"
        >
          <p className="text-[9px] text-[var(--text-muted)] font-semibold uppercase tracking-wider mb-1 inline-flex items-center gap-1.5">
            <Hash className="w-2.5 h-2.5" />
            Transaction Hash
          </p>
          <p className="text-[11px] font-[family-name:var(--font-ibm-plex-mono)] text-[var(--text-secondary)] break-all leading-relaxed">
            {transaction.txHash}
          </p>
          {explorerUrl && (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="
                inline-flex items-center gap-1.5 mt-2 text-[11px] font-medium
                text-[var(--accent)] hover:underline
              "
            >
              View on explorer
              <ExternalLink className="w-3 h-3" strokeWidth={2} />
            </a>
          )}
        </motion.div>
      )}

      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        type="button"
        onClick={onNewSwap}
        className="btn-primary w-full py-3 text-sm cursor-pointer inline-flex items-center justify-center gap-2"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        {theme?.completeCta || 'Buy More Tokens'}
      </motion.button>
    </motion.div>
  )
}

function getExplorerUrl(chainId: number, txHash: string): string {
  if (txHash.startsWith('0x') && txHash.length === 66) {
    const explorers: Record<number, string> = {
      1: 'https://etherscan.io/tx/',
      10: 'https://optimistic.etherscan.io/tx/',
      100: 'https://gnosisscan.io/tx/',
      137: 'https://polygonscan.com/tx/',
      8453: 'https://basescan.org/tx/',
      42161: 'https://arbiscan.io/tx/',
      43114: 'https://snowtrace.io/tx/',
      56: 'https://bscscan.com/tx/',
    }
    return `${explorers[chainId] ?? 'https://etherscan.io/tx/'}${txHash}`
  }
  return `https://meescan.biconomy.io/details/${txHash}`
}
